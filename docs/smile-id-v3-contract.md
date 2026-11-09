# Smile ID V3 document-verification contract review

Source: the owner supplied the text of Smile ID's current **Document Verification** page on 9 November 2026. This review records that supplied documentation; the page and linked API schemas have not been retrieved directly in this workspace. It is not evidence of a completed integration or successful sandbox request.

## Confirmed by the supplied page

- Document Verification checks the document, selfie/document face match, liveness and fraud indicators. It extracts document data; it does not require an issuing-authority lookup.
- The documented submission path is `POST /v3/document_verification`. Requests are asynchronous: `202 Accepted` supplies `job_id` and `user_id` for tracking.
- Inputs include document/selfie/liveness images, issuing country and a callback URL. Document-type selection is optional. The overview does not specify the exact wire field names, headers or image encoding.
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

| Vendor disposition | Required Zetmond handling                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `clear`            | Consider approval only after the authenticated result is bound to the current operation and required identity evidence, country and minimum age are validated. A status string alone is insufficient.                                            |
| `attention`        | Keep financial eligibility blocked. Account settings can allow expired documents or underage results to reach this disposition; Zetmond must still enforce its own requirements. Review/correction policy must not silently approve these cases. |
| `block`            | Do not approve the verification. Preserve the vendor reason and case history. An outcome must not silently turn into a blanket Zetmond account restriction.                                                                                      |
| `error`            | Treat verification as incomplete, not proof of an invalid identity. Reconcile the existing operation and follow documented retry/correction rules before submitting anything again.                                                              |

The documented reasons include age/expiry, document-copy and risk signals, face/liveness/document failures, unsupported documents and technical/image-processing failures. Unknown reason codes must never create an approval. Raw provider messages and image URLs must not be exposed automatically.

## Existing code boundary

`src/providers/smile-id.client.ts` now implements **V3 server token authentication** from the supplied contract, replacing the preliminary V1 signing/web-token/job-status methods. Verification submission, canonical result retrieval, webhook handling and capture still need their own verified schemas. Do not register an active provider based on token acquisition alone.

The generic Task 3 backend already supports durable work, independently authenticated provider callbacks, canonical reconciliation, owner protection, case history and eligibility checks. These remain integration points; no Smile ID adapter is active. Storing Render credentials does not establish authentication or completed KYC.

## Remaining reference pages

The supplied page links to these current documentation resources:

1. **Perform a Document Verification** — `/api-reference/products/document-verification/perform-a-document-verification.md`: environment/base URLs, authentication headers, exact body/image format, operation identifiers, acceptance response and errors. Confirm idempotency and recovery after an uncertain submission.
2. **Retrieve a Verification Result** — `/api-reference/core-resources/verification-status/retrieve-a-verification-result.md`: lookup identifiers, canonical response schema, extracted name/DOB/country fields, finality and any versioning/reconciliation guarantees.
3. **Webhook Types — Document Verification** — `/developer-resources/essentials/verification-webhooks/webhook-types/document-verification.md`: event envelope, result payload and job/customer correlation. Also obtain the receive-webhooks authentication/signature documentation before implementing intake.
4. **Resend Webhook** — `/developer-resources/essentials/verification-webhooks/receive-webhooks/resend-webhook.md`: delivery, replay and retries.
5. **Verify with Document** — `/id-coverage/verify-with-document.md`: supported documents/checks per launch market and applicable account/sandbox capability.

The overview lists REST and mobile SDK integration. It does not establish the current hosted-web/Smile Links contract or a supported web liveness-capture procedure. Resolve that capture contract before implementing the customer journey. A direct REST path may require a different design from the originally proposed provider-hosted capture.

Bank-verification selection, Redis/worker hosting and actual provider-backed sandbox journeys remain outstanding. Staging financial access stays disabled.
