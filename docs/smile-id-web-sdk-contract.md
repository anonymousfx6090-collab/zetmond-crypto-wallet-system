# Smile ID V12 hosted web contract

Source: the owner supplied the current documentation index, hosted **Setup**, **Performing a Verification**, **Getting Result of a Verification**, and Token API Reference on 9 November 2026. These are documentation contracts, not evidence of a successful browser/sandbox integration. The adapter, authenticated token endpoint and capture page are now implemented behind explicit `SMILE_ID_ENABLED` opt-in. This document does not prove account activation or a real sandbox capture.

## Script and initialization

- The hosted embed is installed only by a script tag, not npm: `https://cdn.usesmileid.com/inline/v12/js/script.min.js`. The `v12` URL floats on the latest V12 release.
- It exposes `window.SmileIdentity(config)` and opens a hosted modal. HTTPS or localhost is required for camera access; an enclosing iframe must allow the camera.
- Each verification session needs a fresh backend-minted V3 token. `issueDocumentSessionToken()` now implements dedicated multipart issuance; the existing cached, unscoped server token stays private. The authenticated issuer derives scope from a persisted current owned attempt; its encrypted token resumes across requests and API restart.
- The required `partner_details` object has all five fields: `partner_id`, `name`, `logo_url`, `policy_url`, `theme_color`. The notice uses the configured name/logo/policy; documentation placeholders are not Zetmond's actual notice or branding.
- SDK environment is `sandbox` or `production`, corresponding to the server client's `sandbox` or `live` mode. Do not forward the server's literal `live` value to this SDK.

## Document Verification configuration

The SDK product is **`doc_verification`**. The REST submission path and callback product remain **`document_verification`**. Preserve this explicit mapping.

The flow is consent → country/optional ID type → user details → front/back document capture → selfie/liveness → submission. Document capture and selfie/liveness cannot be skipped. Standard Document Verification can omit `id_type` for vendor auto-classification. Its country/ID/back-side requirements come from `GET /v3/services/supported_documents`; availability/launch-market support must still be confirmed.

Supported common config includes `token`, `callback_url`, `environment`, `partner_details`, `consent_information`, `consent_region`, `user_details`, `id_selection`, `partner_params`, `translation`, `hide_attribution` and result callbacks. Document Verification does **not** use the Biometric KYC `id_info` map. Do not copy the setup's `biometric_kyc`/BVN example into the document flow.

`document_capture_modes` accepts `['camera']` or `['camera', 'upload']` (the default); upload-only is unsupported. Use the provider's real capture procedure, not repeated/static images as a replacement for liveness.

`partner_params` is arbitrary metadata echoed in callbacks. It can carry the internal operation reference, but browser-editable metadata is not authority for subject/operation ownership. The callback HMAC's limited scope is described in the [V3 contract review](smile-id-v3-contract.md).

## User details and consent

If SDK `user_details` is supplied, it must contain `given_names`, `last_name` and at least one of `email`/E.164 `phone_number`. Supplying only an email as the config object fails initialization. Omitting the object lets the flow collect it. Fields bound into the token are removed from the form individually. The supplied token schema confirms separate optional `payload.email`, `given_names` and `last_name`, allowing verified email binding while the SDK collects remaining names.

These SDK requirements do not by themselves establish the full REST `user_details` schema. The preliminary fresh-image server transport's email-only path still needs validation against that REST schema before use. Consumer-stated names/contact details must not replace extracted identity evidence. Zetmond remains email-only for account verification; an SDK phone field would not prove phone ownership or enable SMS.

Pre-obtained `consent_information` has `granted: true` and ISO `granted_at`. Optional notice language/privacy URL default to SDK language/partner policy. The SDK example uses lowercase `en`; the supplied REST consent schema requires two uppercase letters. Keep these models distinct and confirm serialization rather than changing the REST validator to match a UI example.

Omitting pre-obtained consent shows the SDK consent screen. Token-bound consent takes precedence and skips it; do not supply a synthetic acknowledgement to skip this screen. `consent_region` can be `eu`/`non-eu`, otherwise locale/timezone determine checkbox behavior with regulated behavior as the ambiguous default. Returned consent records do not substitute for actual acknowledgement of the notice shown.

## Result handling

`onResult` is preferred over deprecated `onSuccess`, `onClose` and `onError`. The supplied result page defines:

- `success`: `result.value` is the API's verbatim 202 response with `job_id`, `user_id`, `status`, `message`, `created_at`. The envelope `result.status` is `success`, distinct from the nested submission status. Show pending, never approval.
- `failure`: `result.error` has `error_code`, `message`, `status`, `retryable`. Known codes are `CONFIG_INVALID`, `SESSION_INIT_FAILED`, `CONSENT_DENIED`, `SUBMISSION_FAILED`, `NOT_PERMITTED`, `DOCUMENTS_REJECTED`. Use a safe local message map; raw vendor messages are not automatically suitable for customers or logs. Respect denied consent; do not auto-retry. An SDK retry suggestion does not authorize another potentially duplicated verification without server reconciliation.
- `cancelled`: the user closed the UI; no error payload. `product` is carried by every state, except it may be undefined if cancellation preceded product selection.

The SDK says one result fires per flow. Implement application lifecycle protection as well: a stale or repeated callback from an older launch must not replace the current attempt. Submission IDs from the browser are untrusted hints until the backend binds them to the stored operation and vendor result. No callback can grant KYC access.

The result overview calls job/user IDs server-generated, while the normative Token API explicitly supports a partner-provided `user_id`. Preserve the token-bound expected user and verify actual SDK/API behavior in sandbox; do not silently accept an arbitrary different user ID. Correlation should use a unique operation reference in server-bound `partner_params` and an independently protected callback association, not browser metadata alone.

## Token bindings now documented

The supplied [Token API OpenAPI snapshot](contracts/smile-id-v3-token.openapi.json) requires a numeric Partner ID without leading zeros. Token bodies are optional multipart; structured `partner_params` is a string-valued record and `payload` carries identity/consent fields. The client sends the canonical token product `document_verification`, subject ID and `zetmond_operation_id`; payload binds launch country, verified email, HTTPS callback and optional names/ID type/genuine consent. No enrolled-image or re-enrolment grant is accepted by this issuer.

The API describes server-side replacement of downstream fields by token-bound values. Raw `id_number`, names, email and phone are replaced with opaque `pii_` references in the JWT; callback URL becomes a `callback_` reference. Country, ID type and consent remain clear. This is a vendor contract, not proof from a real token; opaque tokens remain credentials and must not be logged or persisted in browser storage.

The issuer returns only the JWT, never the API key or source payload. It does not cache/coalesce requests or fall back to the cached server token on failure. It rejects invalid scopes and too-future consent; local policy retains uppercase notice language and HTTPS notice/callback URLs, a stricter subset of the token API's case-insensitive language and HTTP/HTTPS notice support. Token issuance does not prove identity or reserve a vendor job. Multipart object encoding, bound-field enforcement, callback-reference confidentiality, ID correlation and token-reuse/duplicate behavior still require real SDK/sandbox validation.

The adapter implements a server-owned secret callback route separated by Partner ID and mode. The raw URL is bound in the token payload, with only a non-secret alias in browser config; JWT payloads exposing the literal private capability are rejected. The timestamp HMAC alone still does not sign JSON. Real vendor callback-reference confidentiality and override behavior remain acceptance requirements.

Implemented integration:

- Authenticated `POST /api/identity/capture` derives all scope from the current owned attempt and enforces role, email, eligibility, CSRF, rate and issuance-lease checks. It resumes the same encrypted issued token rather than creating a parallel session or replacing an expired/uncertain one.
- The actual identity-page disclosure acknowledgement and time are durably stored and bound as consent. The SDK collects remaining names, document and fresh selfie/liveness; no email-only `user_details` object is supplied.
- `/identity/capture` lazily loads the SDK after a user action, supplies all branding fields, handles cancelled/failure/success states with safe local messages, and ignores repeated/stale callbacks. It records only submission hints and never approves identity.
- Detailed callback intake, canonical reconciliation, age/country/document/fraud checks, conflict quarantine and durable replay recovery are implemented behind explicit provider opt-in. Staging financial access remains disabled.
- The page does not wrap the vendor flow in another iframe or weaken all customer routes with broad camera/security permissions. Actual hosted origins, camera access and vendor UI remain to validate in the account-backed sandbox run.

Before live activation, complete the sandbox acceptance checklist in [setup](smile-id-setup.md), including token binding/encoding, actual capture/liveness, callback recovery, country/document entitlements and final result behavior. Local browser fixtures do not establish vendor compatibility.

## Current documentation links supplied in the index

- [Hosted setup](https://docs.usesmileid.com/developer-resources/sdks/web/web-sdk/setup.md) — supplied.
- [Performing a verification](https://docs.usesmileid.com/developer-resources/sdks/web/web-sdk/performing-a-verification.md) — supplied.
- [Getting result of a verification](https://docs.usesmileid.com/developer-resources/sdks/web/web-sdk/getting-result-of-a-verification.md) — supplied; result/error union and submission-only semantics recorded above.
- [Theming](https://docs.usesmileid.com/developer-resources/sdks/web/web-sdk/theming-and-customization.md) — brand/localization and supported options.
- [Authentication](https://docs.usesmileid.com/api-reference/authentication.md) — supplied overview; 15-minute lifetime, headers and fresh-token recommendation.
- [Token API Reference](https://docs.usesmileid.com/api-reference/set-up/access.md) — supplied full multipart/payload schema, saved in the OpenAPI snapshot above.
- [Configure your webhook server](https://docs.usesmileid.com/developer-resources/essentials/verification-webhooks/receive-webhooks/configure-your-webhook-server.md) — supplied; HTTPS registration, source IPs, allowlisting and acknowledgement deadline recorded in setup.
- [Web components](https://docs.usesmileid.com/developer-resources/sdks/web/web-components.md) and [submitting payloads](https://docs.usesmileid.com/developer-resources/sdks/web/web-components/submitting-payloads.md) — separately documented composable capture alternative; not implemented.

The index also identifies a current V3 server SDK under `developer-resources/sdks/server-side/`. This is distinct from the previously inspected legacy `smile-identity-core` 3.2.1 package; do not infer current V3 models or retry behavior from that old package.
