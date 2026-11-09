# Smile ID V3 document-verification contract review

Source: the owner supplied the text of Smile ID's current **Document Verification** page on 9 November 2026. This review records that supplied documentation; the page and linked API schemas have not been retrieved directly in this workspace. It is not evidence of a completed integration or successful sandbox request.

## Confirmed by the supplied page

- Document Verification checks the document, selfie/document face match, liveness and fraud indicators. It extracts document data; it does not require an issuing-authority lookup.
- The documented submission path is `POST /v3/document_verification`. Requests are asynchronous: `202 Accepted` supplies `job_id` and `user_id` for tracking.
- The subsequent body reference specifies multipart binary `selfie_image` (JPEG), 6–8 repeated `liveness_images` (JPEG), `document` (front, JPEG/PNG), optional `document_back`, consent, country, user details, optional ID type, user identifier, callback and partner metadata. The server token helper issues no enrolled-image grant or SDK count override, so its fresh-image submission path always requires the selfie and default 6–8 frames.
- Final results arrive through a webhook. Canonical result retrieval reports `processing` while work is outstanding. Webhook replay is supported, but its exact authentication/retry contract is in separate documentation.
- `status`, `message` and `reason` describe the outcome. Extracted `id_fields` vary with document/country. Image links can be sensitive and are not needed in ordinary customer responses.

The owner also supplied these required headers from the V3 verification reference:

| Header               | Documented value                         |
| -------------------- | ---------------------------------------- |
| `SmileID-Partner-ID` | The partner identifier.                  |
| `SmileID-Token`      | An access token returned by `/v3/token`. |

The owner subsequently supplied the token contract:

- `POST https://testapi.smileidentity.com/v3/token` for sandbox, and `POST https://api.smileidentity.com/v3/token` for production.
- Required `SmileID-Partner-ID` and `SmileID-API-Key` headers. The documented minimal curl request is bodyless, with `Accept: application/json`.
- A body is optional. If sent, it must be `multipart/form-data`; JSON may return `415`. Supported optional fields include `user_id`, `partner_params`, `product`, `use_enrolled_image` and `payload`; exact value/serialization contracts remain unprovided.
- Success: HTTP `200`, `{ "token": "<JWT>" }`. Lifetime: 15 minutes. Tokens are environment-specific and go in `SmileID-Token` on subsequent requests with the partner ID.

The server client now implements the documented bodyless authentication request and token lifecycle. Scoped multipart/browser tokens are not implemented by this helper. No real credential/token was provided in chat, and fixture tests do not prove live authentication.

## Submission and consent supplied by the owner

The submission body uses JPEG selfie and 6–8 JPEG liveness images, JPEG/PNG document front and optional back. `user_details` needs email or phone; the current server transport implements the email path. It requires a stable partner user ID, explicit HTTPS callback and launch-country code rather than relying on generated identifiers or an account-default callback. Optional ID type is omitted unless explicitly selected.

Consent fields are `granted: true`, `granted_at` (ISO datetime), `notice_language` (two uppercase letters), and `notice_privacy_policy_url` (HTTPS). The future adapter must derive these from an actual, durable user acknowledgement and the notice shown, not arbitrary browser-supplied values.

A 202 response has `status: accepted`, `message`, generated `job_id`, `user_id` and `created_at`. The client validates tracking fields, checks the returned user, and preserves the generated job ID separately from the internal UUID operation ID. It returns only acceptance metadata, never an approval or arbitrary provider details.

The client sends `partner_params.zetmond_operation_id` for correlation. This is **not a confirmed provider idempotency mechanism**. Intents and provider job references must be persisted by the future adapter. Token failure/input rejection is distinguished from an uncertain dispatched operation; no document request is automatically replayed, including after a 401. A valid job ID in a malformed/mismatched acknowledgement is retained on the uncertainty error for reconciliation.

Structured multipart fields are currently serialized as JSON text using native FormData. The supplied descriptions do not include an actual multipart curl example or object-part encoding rules; confirm this encoding and the full `user_details` schema in vendor examples/sandbox before activation. Original image filenames are replaced by generic role names.

Zetmond's provisional outbound budgets are 10 MiB per image, 40 MiB total image bytes and 16 KiB per JSON metadata field. These are **local transport guards, not documented Smile ID limits**. Basic MIME/byte-signature checks do not prove a valid image, liveness or identity. Provider image size/quality limits and a supported capture procedure remain to confirm. Encrypted SDK packages, enrolled-selfie grants, SDK count overrides and telemetry are not implemented in this fresh-image method.

| Vendor disposition | Required Zetmond handling                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `clear`            | Consider approval only after the authenticated result is bound to the current operation and required identity evidence, country and minimum age are validated. A status string alone is insufficient.                                            |
| `attention`        | Keep financial eligibility blocked. Account settings can allow expired documents or underage results to reach this disposition; Zetmond must still enforce its own requirements. Review/correction policy must not silently approve these cases. |
| `block`            | Do not approve the verification. Preserve the vendor reason and case history. An outcome must not silently turn into a blanket Zetmond account restriction.                                                                                      |
| `error`            | Treat verification as incomplete, not proof of an invalid identity. Reconcile the existing operation and follow documented retry/correction rules before submitting anything again.                                                              |

The documented reasons include age/expiry, document-copy and risk signals, face/liveness/document failures, unsupported documents and technical/image-processing failures. Unknown reason codes must never create an approval. Raw provider messages and image URLs must not be exposed automatically.

## Existing code boundary

`src/providers/smile-id.client.ts` now implements **V3 server token authentication** from the supplied contract, replacing the preliminary V1 signing/web-token/job-status methods. A fresh-image multipart submission transport and 202 tracking parser are now implemented from the supplied body/consent reference. Canonical result retrieval, webhook handling and capture still need their own verified schemas. Do not register an active provider based on token acquisition alone.

The generic Task 3 backend already supports durable work, independently authenticated provider callbacks, canonical reconciliation, owner protection, case history and eligibility checks. These remain integration points; no Smile ID adapter is active. Storing Render credentials does not establish authentication or completed KYC.

## Remaining reference pages

The supplied page links to these current documentation resources:

1. **Perform a Document Verification** — `/api-reference/products/document-verification/perform-a-document-verification.md`: body, consent and acceptance descriptions have been supplied. Still obtain the actual multipart example/object encoding, complete `user_details` schema, image quality/size limits and error/retry semantics. Confirm idempotency and recovery after an uncertain submission.
2. **Retrieve a Verification Result** — `/api-reference/core-resources/verification-status/retrieve-a-verification-result.md`: lookup identifiers, canonical response schema, extracted name/DOB/country fields, finality and any versioning/reconciliation guarantees.
3. **Webhook Types — Document Verification** — `/developer-resources/essentials/verification-webhooks/webhook-types/document-verification.md`: event envelope, result payload and job/customer correlation. Also obtain the receive-webhooks authentication/signature documentation before implementing intake.
4. **Resend Webhook** — `/developer-resources/essentials/verification-webhooks/receive-webhooks/resend-webhook.md`: delivery, replay and retries.
5. **Verify with Document** — `/id-coverage/verify-with-document.md`: supported documents/checks per launch market and applicable account/sandbox capability.

The overview lists REST and mobile SDK integration. It does not establish the current hosted-web/Smile Links contract or a supported web liveness-capture procedure. Resolve that capture contract before implementing the customer journey. A direct REST path may require a different design from the originally proposed provider-hosted capture.

Bank-verification selection, Redis/worker hosting and actual provider-backed sandbox journeys remain outstanding. Staging financial access stays disabled.
