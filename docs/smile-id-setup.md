# Smile ID setup for Task 3

Decision recorded 7 November 2026: the owner selected **Smile ID for KYC** and confirmed that an account has not yet been created. Bank ownership verification remains a separate decision. No Smile ID adapter is active and Task 3 is not complete.

## Account setup

1. Open [Smile ID partner signup](https://portal.usesmileid.com/signup). This is the signup URL linked by Smile ID’s official Node SDK README. If signup requires assistance, use its [contact page](https://usesmileid.com/contact-us).
2. Complete account onboarding and obtain access to the **sandbox** dashboard. The SDK README describes sandbox access as part of signup; actual availability is subject to Smile ID’s current account process.
3. Locate the **Partner ID** and **sandbox API key** in the account’s integration settings. Do not paste keys or passwords into chat or commit them. They belong in protected Render settings once the adapter/configuration is implemented. The existing private `.env` remains untouched.
4. Obtain the current hosted web-capture documentation and enabled product details for government-ID plus selfie/liveness checks. Confirm the supported documents, trusted date-of-birth/country evidence and sandbox fixtures for NG, GH, ZA and KE. Selection alone does not establish country coverage or account eligibility for Zetmond.
5. Provide access to the applicable non-secret integration documentation so the capture, callback, idempotency and canonical decision mapping can be implemented and tested against the actual contract. Tell the development chat when sandbox access is ready; keep credentials in the service’s protected configuration.

The selected capture product must support Zetmond’s ID, liveness and age requirements. A successful selfie registration or identity lookup alone must not become full KYC approval. Confirm any bank-verification offering separately: bank-name lookup alone is insufficient ownership evidence.

## Official sources inspected

- [Official Node SDK repository](https://github.com/smileidentity/smile-identity-core-js), inspected at commit `2e0ecd623f40d1ba944b06fe43dbdcc4176cfff5`.
- Published [`smile-identity-core` 3.2.1](https://www.npmjs.com/package/smile-identity-core/v/3.2.1). Its downloaded archive matched the registry SHA-512 integrity value. Source was inspected without installing or executing the package.
- The full [Smile ID documentation](https://docs.usesmileid.com/) was blocked by this workspace’s outbound network policy. No request was sent to Smile ID’s verification APIs and no real customer evidence or credentials were accessed.

The SDK verifies these server-side contracts:

| Capability | SDK contract | Integration implication |
| --- | --- | --- |
| Environment | Sandbox `https://testapi.smileidentity.com/v1`; live `https://api.smileidentity.com/v1` | Keep credentials, data and enabled adapters separated by mode. |
| Request signing | HMAC-SHA256 with the API-key string over timestamp, Partner ID and `sid_request`; Base64 output | Match the vendor algorithm exactly; do not decode or reinterpret the API key. |
| Hosted-web token | `POST /token` with `user_id`, `job_id`, `product`, `callback_url`, `partner_id`, signature and timestamp | A token is authentication for capture, not an approval or a documented hosted redirect URL. Capture embedding/session-expiry details still need verification. |
| Canonical job status | `POST /job_status` with user/job/partner identifiers, `history`, `image_links` and signature/timestamp | Use stable operation identifiers. Disable image links when unnecessary; verify response authenticity and binding before applying a decision. |
| Signature verification | Timing-safe comparison against the expected timestamp signature | This SDK signature does not include the full JSON body. Callback fields must not directly approve a case; use callbacks to schedule canonical authenticated lookup. Confirm freshness and replay handling. |

The public SDK examples do not establish the complete result/evidence schema or monotonic finality rules required by Zetmond’s provider contract. Do not invent result-code mappings, hosted capture URLs, country support, bank endpoints or revision numbers. Resolve those through current vendor documentation and sandbox evidence before activating an adapter.

## Completing the integration

After sandbox access and the missing contracts are available:

- Implement Smile ID capture/session creation, recovery and allowlisted redirects or embedded capture using the selected documented product.
- Bind all results to persisted customer/case/attempt and sandbox/live mode. Verify ID, liveness, country and age evidence; preserve correction/history and reject stale outcomes.
- Register only the implemented provider callback route, with authentication, freshness, durable deduplication and canonical reconciliation. Do not weaken ordinary browser CSRF checks.
- Add real vendor-contract tests and account-backed sandbox journeys for each enabled market. Existing local fixtures are not Smile ID sandbox evidence.
- Configure Redis and the Render verification worker, then exercise the deployed customer flow. Keep staging financial access disabled.

There are no newly active Smile ID environment variables, API endpoints, collection screens or customer approval switches in this selection update. Provider selection, account creation, adapter completion and successful sandbox evidence are separate milestones.
