# Smile ID setup for Task 3

Decision recorded 7 November 2026: the owner selected **Smile ID for KYC** and subsequently reported access to the Sandbox Credentials page. Credential availability is reported by the owner; no authenticated sandbox request has been demonstrated yet. Bank ownership verification remains a separate decision. No Smile ID adapter is active and Task 3 is not complete.

## Account setup

1. Open [Smile ID partner signup](https://portal.usesmileid.com/signup). This is the signup URL linked by Smile ID’s official Node SDK README. If signup requires assistance, use its [contact page](https://usesmileid.com/contact-us).
2. Complete account onboarding and obtain access to the **sandbox** dashboard. The SDK README describes sandbox access as part of signup; actual availability is subject to Smile ID’s current account process.
3. Locate the **Partner ID** and **sandbox API key** in the account’s integration settings. Do not paste keys or passwords into chat or commit them. Store them in protected Render settings using the names below. The existing private `.env` remains untouched.
4. Obtain the current hosted web-capture documentation and enabled product details for government-ID plus selfie/liveness checks. Confirm the supported documents, trusted date-of-birth/country evidence and sandbox fixtures for NG, GH, ZA and KE. Selection alone does not establish country coverage or account eligibility for Zetmond.
5. Provide access to the applicable non-secret integration documentation so the capture, callback, idempotency and canonical decision mapping can be implemented and tested against the actual contract. Tell the development chat when sandbox access is ready; keep credentials in the service’s protected configuration.

The selected capture product must support Zetmond’s ID, liveness and age requirements. A successful selfie registration or identity lookup alone must not become full KYC approval. Confirm any bank-verification offering separately: bank-name lookup alone is insufficient ownership evidence.

## Official sources inspected

- [Official Node SDK repository](https://github.com/smileidentity/smile-identity-core-js), inspected at commit `2e0ecd623f40d1ba944b06fe43dbdcc4176cfff5`.
- Published [`smile-identity-core` 3.2.1](https://www.npmjs.com/package/smile-identity-core/v/3.2.1). Its downloaded archive matched the registry SHA-512 integrity value. The package was not installed as an application dependency. Its signature class was invoked offline with a fixture key to check a fixed signing test vector; no real credentials or API requests were involved.
- The full [Smile ID documentation](https://docs.usesmileid.com/) was blocked by this workspace’s outbound network policy. No request was sent to Smile ID’s verification APIs and no real customer evidence or credentials were accessed.

The SDK verifies these server-side contracts:

| Capability             | SDK contract                                                                                             | Integration implication                                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Environment            | Sandbox `https://testapi.smileidentity.com/v1`; live `https://api.smileidentity.com/v1`                  | Keep credentials, data and enabled adapters separated by mode.                                                                                                                                             |
| Request signing        | HMAC-SHA256 with the API-key string over timestamp, Partner ID and `sid_request`; Base64 output          | Match the vendor algorithm exactly; do not decode or reinterpret the API key.                                                                                                                              |
| Hosted-web token       | `POST /token` with `user_id`, `job_id`, `product`, `callback_url`, `partner_id`, signature and timestamp | A token is authentication for capture, not an approval or a documented hosted redirect URL. Capture embedding/session-expiry details still need verification.                                              |
| Canonical job status   | `POST /job_status` with user/job/partner identifiers, `history`, `image_links` and signature/timestamp   | Use stable operation identifiers. Disable image links when unnecessary; verify response authenticity and binding before applying a decision.                                                               |
| Signature verification | Timing-safe comparison against the expected timestamp signature                                          | This SDK signature does not include the full JSON body. Callback fields must not directly approve a case; use callbacks to schedule canonical authenticated lookup. Confirm freshness and replay handling. |

The public SDK examples do not establish the complete result/evidence schema or monotonic finality rules required by Zetmond’s provider contract. Do not invent result-code mappings, hosted capture URLs, country support, bank endpoints or revision numbers. Resolve those through current vendor documentation and sandbox evidence before activating an adapter.

## Render credential settings

In **Render → zetmond-wallet → Environment → Edit**, add these rows without changing existing values:

| Variable              | Value                                                            |
| --------------------- | ---------------------------------------------------------------- |
| `SMILE_ID_PARTNER_ID` | Partner ID from the Smile ID dashboard                           |
| `SMILE_ID_API_KEY`    | Sandbox API key from Sandbox Credentials; keep the value private |
| `SMILE_ID_MODE`       | `sandbox`                                                        |

These names are parsed by the new API configuration. The API key is a server secret; never put it in a `NEXT_PUBLIC_` variable, the customer/marketing Vercel settings, source control or chat. Preserve `DEPLOYMENT_STAGE=staging`. Partial credential configuration does not break the existing authentication service; constructing the Smile ID client requires the complete pair and a mode consistent with the deployment stage.

`src/providers/smile-id.client.ts` implements only the SDK-verified server primitives: request signing, hosted-web token requests and authenticated canonical status requests. Origins are fixed per mode, redirects are rejected, requests have deadlines, response size is bounded and errors omit upstream details. Credential fields use JavaScript private fields. Responses are server-only envelopes, not domain approval evidence. No automatic retry is applied to an unknown provider outcome.

Validation: the API build and 34 tests (10 Smile ID client tests plus 24 authentication regressions) passed in the isolated workspace, excluding private environment files. Transport tests use fixture responses; no authenticated Smile ID sandbox journey has run.

The client has no public HTTP route and is **not registered as an active verification adapter**. Storing credentials alone does not activate KYC. Capture integration, product selection, result/evidence binding and finality still need the current documented contracts and real sandbox evidence. The existing UI remains unavailable until that work is finished.

## Completing the integration

After sandbox access and the missing contracts are available:

- Implement Smile ID capture/session creation, recovery and allowlisted redirects or embedded capture using the selected documented product.
- Bind all results to persisted customer/case/attempt and sandbox/live mode. Verify ID, liveness, country and age evidence; preserve correction/history and reject stale outcomes.
- Register only the implemented provider callback route, with authentication, freshness, durable deduplication and canonical reconciliation. Do not weaken ordinary browser CSRF checks.
- Add real vendor-contract tests and account-backed sandbox journeys for each enabled market. Existing local fixtures are not Smile ID sandbox evidence.
- Configure Redis and the Render verification worker, then exercise the deployed customer flow. Keep staging financial access disabled.

Smile ID credential configuration and server-client primitives are implemented; no Smile ID verification adapter, public provider endpoint or customer approval switch is active. Provider selection, account creation, adapter completion and successful sandbox evidence are separate milestones.
