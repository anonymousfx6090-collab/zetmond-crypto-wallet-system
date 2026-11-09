# Smile ID setup for Task 3

Updated 9 November 2026. The owner selected Smile ID for KYC, obtained sandbox credentials and reported saving them in Render. The owner last confirmed that the API health check returned staging. **The code now implements V3 token authentication, fresh-image document submission and job-status retrieval; no Smile ID verification adapter is active and Task 3 is not complete.** Bank verification remains a separate integration decision.

## Render credential settings

Use **Render → zetmond-wallet → Environment → Edit**:

| Variable              | Value                                              |
| --------------------- | -------------------------------------------------- |
| `SMILE_ID_PARTNER_ID` | Partner ID from Smile ID                           |
| `SMILE_ID_API_KEY`    | The actual sandbox API key; keep the value private |
| `SMILE_ID_MODE`       | `sandbox`                                          |

Preserve the existing database/encryption key and `DEPLOYMENT_STAGE=staging`. These credentials are server settings, not customer/marketing Vercel or `NEXT_PUBLIC_` values. The owner’s private `.env` was not read or changed. Partial configuration does not break ordinary account access; explicitly constructing a Smile ID client requires a complete pair and a mode consistent with the hosted deployment stage.

## V3 authentication implemented

The owner supplied this token contract on 9 November 2026:

- Sandbox: `POST https://testapi.smileidentity.com/v3/token`.
- Production: `POST https://api.smileidentity.com/v3/token`.
- Required headers: `SmileID-Partner-ID` and `SmileID-API-Key`; `Accept: application/json` requests the JSON response.
- Body is optional. The documented minimal request has no body. When present, a body must be `multipart/form-data`; JSON can produce `415`.
- Success is `200` with a `token` JWT. The token lasts 15 minutes and belongs to the selected environment.
- Subsequent verification requests use `SmileID-Partner-ID` plus `SmileID-Token`. The access token is not the API key and is not the mobile SDK configuration's `auth_token`.

`apps/api/src/providers/smile-id.client.ts` uses the documented **bodyless** token request. It does not send JSON or a Content-Type header to the token endpoint. The client keeps API keys and tokens in private fields, rejects redirects, bounds response sizes, sets a request deadline and reports safe errors without upstream bodies or credentials.

Tokens are reused per client/credential/environment instance and refreshed after 14 minutes, measured from request start with a monotonic clock. Concurrent requests share token issuance. Expired or invalidated tokens are not served, and an old refresh cannot replace a newer token. A late rejection of an older token does not discard a newer one. Token failures do not automatically replay verification or other business requests.

This is a **server-only, unscoped token helper**. Optional token fields (`user_id`, `partner_params`, `product`, `use_enrolled_image`, `payload`) and browser-capture token scopes are not implemented without their exact field/serialization contracts. Do not expose this server token to customers or interpret JWT claims as KYC evidence. There is no public credential-check/token HTTP route.

## Owner-operated credential check

After this branch is merged and the API build deployed, an owner-operated terminal in the service environment can run:

```sh
node apps/api/dist/check-smile-id.js
```

Or from the built API package: `pnpm --filter @zetmond/api smile:check`.

For example, use a Render Shell if the service plan provides one. The command reads the protected service environment, requests a V3 token, and prints only success/failure and mode. It does not print a token/key, submit identity evidence or enable KYC. It exits nonzero for missing, mismatched or rejected credentials. No actual Smile ID authentication has been demonstrated in this workspace; automated tests use fixture responses.

Validation: the isolated frozen dependency install and API TypeScript build passed, along with 17 V3 authentication/client checks. Two compiled-CLI fixture runs confirmed nonzero exits and secret-safe output for missing/invalid configuration. Private environment files were excluded, and no real Smile ID request was made by the agent.

The normal API start/build commands are unchanged. Storing keys or running this check does not enable the capture journey.

## References and superseded research

The owner supplied the current Document Verification overview and V3 token method/headers/response/expiry details. See the [V3 contract review](smile-id-v3-contract.md) for the evidence and remaining references. The full documentation site remains blocked by this workspace's network policy.

The official `smile-identity-core` 3.2.1 SDK was initially inspected at repository commit `2e0ecd623f40d1ba944b06fe43dbdcc4176cfff5`. That older SDK documented V1 signing/web-token/job-status primitives. The preliminary V1 methods have now been removed from the client rather than mixed with the supplied V3 contract; their original fixture tests are superseded by V3 authentication tests.

## Document submission transport

The server client can prepare and submit the fresh-image multipart path described by the owner: document/selfie/liveness parts, four-field consent, country, email contact, a stable user ID, explicit callback, optional document back/ID type and operation-correlation metadata. It accepts the generated job ID separately from Zetmond's internal operation ID. `202 Accepted` is not KYC approval. It does not support enrolled-image grants or encrypted SDK packages yet.

The adapter is still inactive. It must durably record an intent before submission and save/recover the generated job ID. `SmileIdSubmissionError.outcome` distinguishes `not_submitted` from `unknown`. An uncertain result, including malformed acceptance or unexpected HTTP response, must be reconciled before retrying; the transport never automatically replays a document request. Known job references are preserved on uncertainty errors when available.

JSON text is used for structured multipart parts; verify against the vendor's actual curl example/sandbox before activation. Confirm the complete user-details schema and vendor image limits. Local budgets and basic byte-signature checks are transport guards, not identity checks. See the [V3 contract review](smile-id-v3-contract.md).

Validation: 15 document-submission checks and all 17 authentication/client checks passed, along with the isolated API TypeScript build. The checks cover native multipart encoding, consent and image constraints, correlation, response binding, exact V3 job-ID format and uncertain outcomes without replay. They use mocked HTTP responses and synthetic image-header bytes, not real identity evidence or a Smile ID sandbox call.

## Job status lookup

`getVerificationStatus({ jobId, userId })` makes a bodyless GET to `/v3/status/{jobId}` at the fixed sandbox/live origin with server-only token headers. The caller must supply references from the persisted current operation. The flat response must match both references and the documented HTTP/disposition combination: 202/processing or 200/clear, block, attention, error. The returned DTO contains tracking only; raw messages and extra provider data are discarded. `responseGeneratedAt` names the provider's `created_at` according to its documented meaning, not as an identity-verification timestamp or decision revision.

Input/response mismatch, transport failures and HTTP errors are held as errors. In particular, a 404 can mean a missing job or the wrong partner/token-bound user; it must not authorize a new submission. A 401 invalidates the rejected cached token without automatic replay. Lookups use the existing bounded response reader, reject redirects and set a deadline. The method adds no HTTP route, active provider or polling worker.

Validation: **44 targeted checks passed** (17 authentication/client, 15 document submission and 12 status retrieval), along with the isolated API TypeScript build. The status checks cover the supplied flat JSON contract, owner/job binding, all terminal dispositions, HTTP/body conflicts, unsafe references, ambiguous 404, 401 handling, bounded/sanitized failures and explicit subsequent polls. All HTTP responses are fixtures; no real provider call was made.

## Remaining integration work

- Confirm multipart object encoding against a real documentation example, full user-details schema, vendor image limits and idempotency/recovery rules. Body/consent fields and acceptance tracking have been supplied and implemented in the transport.
- Verify the current web/Smile Links or other supported browser capture contract. The supplied overview documents REST and mobile SDKs, not a complete hosted-web procedure.
- Obtain the detailed verification evidence and its canonical retrieval/authenticated webhook contract. GET status tracking is implemented, but the supplied schema has no name/DOB/country, document/face/liveness evidence or decision revision. Also obtain webhook authentication/payload schemas and establish job/customer/product binding and finality/versioning.
- Implement the adapter with durable intents, authenticated callbacks, reconciliation, correction history, strict age/country checks and mode isolation. Register it only after these checks are implemented.
- Confirm document/check coverage for each enabled market and exercise actual account-backed sandbox journeys. Local fixtures do not establish country coverage or vendor integration success.
- Choose/connect bank ownership verification and configure Redis/Render worker hosting. Staging financial access remains disabled.
