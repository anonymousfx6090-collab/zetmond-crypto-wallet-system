# Smile ID setup for Task 3

Updated 9 November 2026. The owner selected Smile ID for KYC, obtained sandbox credentials and reported saving them in Render. The owner last confirmed that the API health check returned staging. **The code now implements V3 token authentication, fresh-image document submission, job-status retrieval, notification proof and callback replay; no Smile ID verification adapter is active and Task 3 is not complete.** Bank verification remains a separate integration decision.

## Render credential settings

Use **Render → zetmond-wallet → Environment → Edit**:

| Variable              | Value                                              |
| --------------------- | -------------------------------------------------- |
| `SMILE_ID_PARTNER_ID` | Partner ID from Smile ID                           |
| `SMILE_ID_API_KEY`    | The actual sandbox API key; keep the value private |
| `SMILE_ID_MODE`       | `sandbox`                                          |

Preserve the existing database/encryption key and `DEPLOYMENT_STAGE=staging`. These credentials are server settings, not customer/marketing Vercel or `NEXT_PUBLIC_` values. The owner’s private `.env` was not read or changed. Partial configuration does not break ordinary account access; explicitly constructing a Smile ID client requires a complete pair and a mode consistent with the hosted deployment stage.

## V3 authentication implemented

Partner IDs are validated in configuration and direct clients as numeric strings without leading zeros. Test fixtures use a synthetic valid ID; no owner credential was read or changed.

The owner supplied this token contract on 9 November 2026:

- Sandbox: `POST https://testapi.smileidentity.com/v3/token`.
- Production: `POST https://api.smileidentity.com/v3/token`.
- Required headers: `SmileID-Partner-ID` and `SmileID-API-Key`; `Accept: application/json` requests the JSON response.
- Body is optional. The documented minimal request has no body. When present, a body must be `multipart/form-data`; JSON can produce `415`.
- Success is `200` with a `token` JWT. The token lasts 15 minutes and belongs to the selected environment.
- Subsequent verification requests use `SmileID-Partner-ID` plus `SmileID-Token`. The access token is not the API key and is not the mobile SDK configuration's `auth_token`.

`apps/api/src/providers/smile-id.client.ts` uses the documented **bodyless** token request. It does not send JSON or a Content-Type header to the token endpoint. The client keeps API keys and tokens in private fields, rejects redirects, bounds response sizes, sets a request deadline and reports safe errors without upstream bodies or credentials.

Tokens are reused per client/credential/environment instance and refreshed after 14 minutes, measured from request start with a monotonic clock. Concurrent requests share token issuance. Expired or invalidated tokens are not served, and an old refresh cannot replace a newer token. A late rejection of an older token does not discard a newer one. Token failures do not automatically replay verification or other business requests.

`getAccessToken()` and `getRequestHeaders()` are **server-only, unscoped token helpers** for lookup/replay. Do not expose these cached tokens to customers or interpret JWT claims as KYC evidence. New document submissions and the dedicated document-session issuer request fresh tokens. The session helper below supplies the documented bindings; enrolled-image and re-enrolment grants are not supported. There is no public credential-check/token HTTP route.

## Owner-operated credential check

After this branch is merged and the API build deployed, an owner-operated terminal in the service environment can run:

```sh
node apps/api/dist/check-smile-id.js
```

Or from the built API package: `pnpm --filter @zetmond/api smile:check`.

For example, use a Render Shell if the service plan provides one. The command reads the protected service environment, requests a V3 token, and prints only success/failure and mode. It does not print a token/key, submit identity evidence or enable KYC. It exits nonzero for missing, mismatched or rejected credentials. No actual Smile ID authentication has been demonstrated in this workspace; automated tests use fixture responses.

Validation: the isolated frozen dependency install and API TypeScript build passed. The current authentication/client suite has 18 checks, including numeric Partner IDs and secret-safe configuration errors. Earlier compiled-CLI fixture runs confirmed nonzero exits and secret-safe output for missing/invalid configuration. Private environment files were excluded, and no real Smile ID request was made by the agent.

The normal API start/build commands are unchanged. Storing keys or running this check does not enable the capture journey.

## References and superseded research

The owner supplied the current Document Verification overview and V3 token method/headers/response/expiry details. See the [V3 contract review](smile-id-v3-contract.md) for the evidence and remaining references. The full documentation site remains blocked by this workspace's network policy.

The official `smile-identity-core` 3.2.1 SDK was initially inspected at repository commit `2e0ecd623f40d1ba944b06fe43dbdcc4176cfff5`. That older SDK documented V1 signing/web-token/job-status primitives. The preliminary V1 methods have now been removed from the client rather than mixed with the supplied V3 contract; their original fixture tests are superseded by V3 authentication tests.

## Document submission transport

The server client can prepare and submit the fresh-image multipart path described by the owner: document/selfie/liveness parts, four-field consent, country, email contact, a stable user ID, explicit callback, optional document back/ID type and operation-correlation metadata. It accepts the generated job ID separately from Zetmond's internal operation ID. `202 Accepted` is not KYC approval. It does not support enrolled-image grants or encrypted SDK packages yet.

The adapter is still inactive. It must durably record an intent before submission and save/recover the generated job ID. `SmileIdSubmissionError.outcome` distinguishes `not_submitted` from `unknown`. An uncertain result, including malformed acceptance or unexpected HTTP response, must be reconciled before retrying; the transport never automatically replays a document request. Known job references are preserved on uncertainty errors when available.

JSON text is used for structured multipart parts; verify against the vendor's actual curl example/sandbox before activation. Confirm the complete user-details schema and vendor image limits. Local budgets and basic byte-signature checks are transport guards, not identity checks. See the [V3 contract review](smile-id-v3-contract.md).

Validation: 16 document-submission checks passed, covering native multipart encoding, consent/image constraints, correlation, response binding, exact job-ID format, uncertain outcomes without replay and fresh per-verification tokens isolated from the lookup cache. They use mocked HTTP responses and synthetic image-header bytes, not real identity evidence or a Smile ID sandbox call.

## Job status lookup

`getVerificationStatus({ jobId, userId })` makes a bodyless GET to `/v3/status/{jobId}` at the fixed sandbox/live origin with server-only token headers. The caller must supply references from the persisted current operation. The flat response must match both references and the documented HTTP/disposition combination: 202/processing or 200/clear, block, attention, error. The returned DTO contains tracking only; raw messages and extra provider data are discarded. `responseGeneratedAt` names the provider's `created_at` according to its documented meaning, not as an identity-verification timestamp or decision revision.

Input/response mismatch, transport failures and HTTP errors are held as errors. In particular, a 404 can mean a missing job or the wrong partner/token-bound user; it must not authorize a new submission. A 401 invalidates the rejected cached token without automatic replay. Lookups use the existing bounded response reader, reject redirects and set a deadline. The method adds no HTTP route, active provider or polling worker.

The 12 status checks cover the supplied flat JSON contract, owner/job binding, all terminal dispositions, HTTP/body conflicts, unsafe references, ambiguous 404, 401 handling, bounded/sanitized failures and explicit subsequent polls. All HTTP responses are fixtures; no real provider call was made.

## Webhook notification proof

The owner supplied the V3 signature formula and delivery rules. `verifyWebhookSignal()` now checks Base64 HMAC-SHA256 over the exact timestamp + partner ID + `sid_request`, using this client's API key. It rejects malformed/duplicate headers, mismatched stored job/user references and timestamps outside Zetmond's local five-minute skew window. It compares digests in constant time and returns a reconciliation-only signal with a deterministic dedupe key. It makes no network request and adds no callback route or provider registration.

The formula does not cover the JSON body, job/user IDs or mode. It must not authenticate detailed identity evidence or directly approve a customer. Mode and original credentials must come from the stored operation; durable deduplication and trusted result recovery remain to implement. The signature check alone is not a complete webhook integration. See the [contract review](smile-id-v3-contract.md) for the exact trust boundary, original-key rotation requirement, four-attempt retry budget and 35-second response deadline.

The 10 webhook proof checks use a fixture independently calculated with Python to verify the exact HMAC formula. They also cover unsafe encodings, wrong keys/partner, timestamp boundaries, case/duplicate headers, reference mismatch, deterministic deduplication and the formula's lack of job/mode binding. No live Smile ID callback was exercised; private environment files remain excluded.

## Callback replay

`replayVerificationWebhook({ jobId, userId })` first obtains current, matching job status and permits only terminal jobs. It then sends one bodyless `POST /v3/replay/{job_id}` using the stored callback URL. The client accepts no callback override and sends no JSON body/Content-Type. Only a bound, valid 202 acknowledgement is returned; this means queued delivery, not a received callback or KYC approval.

`SmileIdReplayError` distinguishes `not_queued` for this request from `unknown`. Documented client rejections/409 are not queued; uncertain dispatch/server responses or malformed acknowledgement require reconciliation before another replay POST. Errors do not create/restart verification. A 401 invalidates only the rejected token without automatic resend. The future adapter must durably record/deduplicate/rate-limit replay intents; no HTTP replay route or worker is active.

The 13 replay checks cover the exact bodyless API contract, terminal preflight, owner/job binding, 409/error handling, uncertain outcomes, token invalidation/refresh and bounded responses. All provider responses are fixtures; no live replay was requested.

## Dedicated document-session token transport

`issueDocumentSessionToken()` now prepares the supplied Token API multipart request with a fixed `document_verification` product, known subject/operation, country, verified email, HTTPS callback and optional names/ID type/genuine consent. It uses fresh issuance per call, never the cached server token, and returns only the opaque JWT. No permission to use an enrolled image or replace an enrolled selfie is granted. The current OpenAPI reference is saved in [the token contract snapshot](contracts/smile-id-v3-token.openapi.json).

The token API binds payload fields over downstream browser values and describes opaque PII/callback references in the JWT. Actual vendor enforcement and object-part encoding still require sandbox validation. The helper enforces Zetmond's stricter uppercase/HTTPS notice policy and the documented one-minute future-consent limit. Errors are sanitized, late-issued tokens rejected, and concurrent sessions neither share tokens nor alter lookup caching. No public browser token route or SDK integration is active.

Validation: **81 targeted checks and the isolated API TypeScript build passed** (18 authentication/client, 16 document submission, 12 status retrieval, 10 webhook proof, 13 replay and 12 session issuance). All requests are intercepted fixtures. No real token, replay, capture or callback was exercised by the agent; the owner's private `.env` was neither read nor changed.

## Hosted web contract received

The owner supplied the current V12 hosted setup, verification configuration, result union and token schema. The [hosted web contract](smile-id-web-sdk-contract.md) records the CDN script, `doc_verification` SDK product alias, branding, consent/user-details and submission-only result rules. SDK installation is script-only, not npm. The dedicated bound-token transport is implemented, but its authenticated browser endpoint, persisted attempt integration and SDK modal are not active yet.

## Remaining integration work

- The owner supplied a detailed Document Verification webhook example, including identity fields, job/user references and fraud signals. It includes `clear` alongside high fraud risk and uses placeholder country `XX`; it is not approval evidence. Authentication/delivery rules are now supplied and the timestamp proof is implemented, but complete disposition schemas and trusted recovery/revision guarantees are still needed. No Smile ID callback route or result normalizer is active. See the [contract review](smile-id-v3-contract.md).
- Confirm multipart object encoding against a real documentation example, full user-details schema, vendor image limits and idempotency/recovery rules. Body/consent fields and acceptance tracking have been supplied and implemented in the transport.
- Connect the supplied token/result schemas to the hosted V12 browser flow. Match exact product/environment values and enforce ownership, current attempt, rate/duplicate limits and country on the server before exposing a token.
- Establish trustworthy processing and recovery of the detailed webhook evidence. The timestamp-HMAC and payload example are supplied, but that HMAC does not cover identity fields. GET status tracking lacks detailed identity evidence and a decision revision. Callback replay is implemented as delivery recovery only; complete disposition schemas, evidence binding and finality/versioning remain outstanding.
- Implement the adapter with durable intents, authenticated callbacks, reconciliation, correction history, strict age/country checks and mode isolation. Register it only after these checks are implemented.
- Confirm document/check coverage for each enabled market and exercise actual account-backed sandbox journeys. Local fixtures do not establish country coverage or vendor integration success.
- Choose/connect bank ownership verification and configure Redis/Render worker hosting. Staging financial access remains disabled.
