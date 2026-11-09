# Smile ID V12 hosted web contract

Source: the owner supplied the current documentation index, hosted **Setup** and **Performing a Verification** pages on 9 November 2026. These are documentation contracts, not evidence of a successful browser/sandbox integration. No SDK script, browser token endpoint or active capture adapter is enabled by this document.

## Script and initialization

- The hosted embed is installed only by a script tag, not npm: `https://cdn.usesmileid.com/inline/v12/js/script.min.js`. The `v12` URL floats on the latest V12 release.
- It exposes `window.SmileIdentity(config)` and opens a hosted modal. HTTPS or localhost is required for camera access; an enclosing iframe must allow the camera.
- Each verification session needs a fresh backend-minted V3 token. The existing cached, unscoped server token must remain private; it is not a browser session token issuer.
- The required `partner_details` object has all five fields: `partner_id`, `name`, `logo_url`, `policy_url`, `theme_color`. The notice uses the configured name/logo/policy; documentation placeholders are not Zetmond's actual notice or branding.
- SDK environment is `sandbox` or `production`, corresponding to the server client's `sandbox` or `live` mode. Do not forward the server's literal `live` value to this SDK.

## Document Verification configuration

The SDK product is **`doc_verification`**. The REST submission path and callback product remain **`document_verification`**. Preserve this explicit mapping.

The flow is consent → country/optional ID type → user details → front/back document capture → selfie/liveness → submission. Document capture and selfie/liveness cannot be skipped. Standard Document Verification can omit `id_type` for vendor auto-classification. Its country/ID/back-side requirements come from `GET /v3/services/supported_documents`; availability/launch-market support must still be confirmed.

Supported common config includes `token`, `callback_url`, `environment`, `partner_details`, `consent_information`, `consent_region`, `user_details`, `id_selection`, `partner_params`, `translation`, `hide_attribution` and result callbacks. Document Verification does **not** use the Biometric KYC `id_info` map. Do not copy the setup's `biometric_kyc`/BVN example into the document flow.

`document_capture_modes` accepts `['camera']` or `['camera', 'upload']` (the default); upload-only is unsupported. Use the provider's real capture procedure, not repeated/static images as a replacement for liveness.

`partner_params` is arbitrary metadata echoed in callbacks. It can carry the internal operation reference, but browser-editable metadata is not authority for subject/operation ownership. The callback HMAC's limited scope is described in the [V3 contract review](smile-id-v3-contract.md).

## User details and consent

If SDK `user_details` is supplied, it must contain `given_names`, `last_name` and at least one of `email`/E.164 `phone_number`. Supplying only an email as the config object fails initialization. Omitting the object lets the flow collect it. Fields bound into the token are removed from the form individually, so the backend may be able to bind verified email while the SDK collects remaining names; exact token payload definitions are still needed.

These SDK requirements do not by themselves establish the full REST `user_details` schema. The preliminary fresh-image server transport's email-only path still needs validation against that REST schema before use. Consumer-stated names/contact details must not replace extracted identity evidence. Zetmond remains email-only for account verification; an SDK phone field would not prove phone ownership or enable SMS.

Pre-obtained `consent_information` has `granted: true` and ISO `granted_at`. Optional notice language/privacy URL default to SDK language/partner policy. The SDK example uses lowercase `en`; the supplied REST consent schema requires two uppercase letters. Keep these models distinct and confirm serialization rather than changing the REST validator to match a UI example.

Omitting pre-obtained consent shows the SDK consent screen. Token-bound consent takes precedence and skips it; do not supply a synthetic acknowledgement to skip this screen. `consent_region` can be `eu`/`non-eu`, otherwise locale/timezone determine checkbox behavior with regulated behavior as the ambiguous default. Returned consent records do not substitute for actual acknowledgement of the notice shown.

## Result handling and remaining implementation

`onResult` is preferred over deprecated `onSuccess`, `onClose` and `onError`. Known states are `success`, `failure` and `cancelled`. Success indicates submission/202 acceptance, not a KYC verdict; it must show pending status while the server verifies the result. Exact callback payload and error schemas are in the result page listed below and remain to obtain.

Before activation:

- Implement fresh, authenticated, operation-bound browser token issuance from the actual `/v3/token` multipart/payload schema. Preserve normal session, role, email verification, current-attempt, rate/duplicate and CSRF checks; the documentation's generic GET `/sessions/new` is an example, not Zetmond's API design.
- Establish vendor token/user/product/country/callback binding and duplicate-submission/recovery semantics. Browser config/metadata alone cannot enforce these.
- Integrate SDK lifecycle and safe result/error handling with the existing persisted attempts. Add the required script/frame/connect origins and route-specific camera permissions after confirming the actual hosted origins; do not relax all customer routes.
- Implement trustworthy detailed-result intake, current-operation binding, country/age/document/fraud checks and recovery before registering the provider. Keep staging financial access disabled.
- Exercise actual account-backed sandbox capture and callbacks, separately from mocked browser tests. Confirm enabled markets/documents and applicable SDK/account configuration.

## Current documentation links supplied in the index

- [Hosted setup](https://docs.usesmileid.com/developer-resources/sdks/web/web-sdk/setup.md) — supplied.
- [Performing a verification](https://docs.usesmileid.com/developer-resources/sdks/web/web-sdk/performing-a-verification.md) — supplied.
- [Getting result of a verification](https://docs.usesmileid.com/developer-resources/sdks/web/web-sdk/getting-result-of-a-verification.md) — exact `onResult` payload/error union and final-verdict handling.
- [Theming](https://docs.usesmileid.com/developer-resources/sdks/web/web-sdk/theming-and-customization.md) — brand/localization and supported options.
- [Authentication](https://docs.usesmileid.com/api-reference/authentication.md) — complete token request/payload/scoping contract.
- [Configure your webhook server](https://docs.usesmileid.com/developer-resources/essentials/verification-webhooks/receive-webhooks/configure-your-webhook-server.md) — hosting and any additional callback authentication configuration.
- [Web components](https://docs.usesmileid.com/developer-resources/sdks/web/web-components.md) and [submitting payloads](https://docs.usesmileid.com/developer-resources/sdks/web/web-components/submitting-payloads.md) — separately documented composable capture alternative; not implemented.

The index also identifies a current V3 server SDK under `developer-resources/sdks/server-side/`. This is distinct from the previously inspected legacy `smile-identity-core` 3.2.1 package; do not infer current V3 models or retry behavior from that old package.
