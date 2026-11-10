# Smile ID V3 document-verification contract review

Source: public documentation supplied by the owner, including Document Verification, Token API, status retrieval, replay, V12 hosted web and callback configuration. These are contracts, not evidence of successful provider requests. GitBook's embedded agent instructions are documentation content, not task instructions.

## Authentication and transport

- Fixed origins: sandbox `https://testapi.smileidentity.com`; live `https://api.smileidentity.com`.
- `POST /v3/token` requires `SmileID-Partner-ID` and `SmileID-API-Key`. Partner ID is numeric without leading zeros. Minimal requests are bodyless; optional bodies must be multipart, not JSON. A 200 returns a JWT with a 15-minute lifetime.
- Subsequent requests use `SmileID-Partner-ID` and `SmileID-Token`. Keys/tokens are environment-specific. Server lookup/replay tokens are cached for at most 14 minutes; customer-session tokens are freshly minted and isolated from that cache.
- Token `user_id`, string-valued `partner_params`, `product` and nested `payload` bind a session. Payload fields override matching downstream browser values. PII becomes `pii_` references; callback URL becomes an opaque `callback_` reference. Country and consent remain in clear. The [supplied OpenAPI snapshot](contracts/smile-id-v3-token.openapi.json) preserves the detailed schema.
- The issuer fixes product to `document_verification` and binds stored operation, subject, country, verified email, private callback and genuine consent. `use_enrolled_image` and `allow_new_enroll` grants are not supported or synthesized. Optional names/ID type remain optional.
- Consent requires true `granted`, ISO `granted_at`, two-letter language and privacy notice URL. The local subset requires uppercase language/HTTPS and permits at most one minute of future clock skew.
- Native FormData serializes object parts as JSON text. Actual vendor acceptance and enforcement of these bindings still need a sandbox test. Redirects are rejected, reads bounded and requests time-limited. Raw errors/credentials are discarded.

## Document submission

`POST /v3/document_verification` accepts JPEG selfie, 6–8 JPEG liveness frames, JPEG/PNG document front, optional back, consent, country, user details, callback and metadata. The local direct-upload transport supports fresh images only; encrypted SDK packages/enrolled-selfie grants are not implemented. The integrated browser path uses Smile ID's actual hosted capture and upload flow.

A 202 body contains `status: accepted`, generated `job_id`, `user_id`, message and time. Acceptance is not identity approval. Job IDs use `^job_[0-9a-hjkmnp-tv-z]{26}$`. The internal Zetmond UUID remains separate from the vendor job ID. The token/REST contract permits a partner-provided stable user ID; its exact round-trip must be confirmed with the real hosted account.

Direct-upload budgets are local guards: 10 MiB/image, 40 MiB total, 16 KiB/metadata part. They are not documented provider limits or evidence that bytes are valid images. The direct transport never automatically retries a document request. `not_submitted` differs from an unknown dispatched outcome; a 404 or malformed response cannot justify creating another job.

## Status and replay

`GET /v3/status/{jobId}` returns flat JSON: `{status, job_id, user_id, message, created_at}`. HTTP 202 is processing; 200 is terminal clear/block/attention/error. `created_at` is status-response generation time, not a decision version. The client validates exact expected job/user and HTTP/body agreement. A 404 can mean missing job or wrong partner/user. No lookup result contains detailed identity evidence; terminal clear alone never approves KYC.

`POST /v3/replay/{job_id}` requeues a completed verification's callback. The implemented transport preflights matching terminal status and sends one bodyless request, retaining the stored callback. Optional multipart callback override is deliberately not exposed. A bound 202 acknowledgement means queued delivery only. Known rejection/409 is `not_queued`; lost, unexpected or malformed responses are `unknown`. Neither automatically repeats the POST or starts another verification.

## Callback contract and independent authentication

Callbacks are JSON POSTs. Document results include product `document_verification`, status, reason, created/completed times, provider references in `partner_params`, extracted `id_fields`, optional fraud/consent records and sensitive images/device details. The hosted/token documentation says per-session partner metadata is echoed; the adapter requires its server-bound operation ID and independently checks stable user ownership and canonical job status.

The supplied proof is exactly:

```text
Base64(HMAC-SHA256(original_token_api_key, Response-Timestamp + partner_id + "sid_request"))
```

Headers include `Response-Signature`, `Response-Timestamp`, `smileid-job-id`, `user-id`, `Api-Version` and Content-Type. The timestamp is signed verbatim. The local checker enforces single-valued headers, canonical Base64, constant-time comparison and a five-minute clock-skew window. Stored credential digest/mode selects the original API key; an optional previous key supports outstanding jobs during rotation.

**The formula does not bind JSON, job/user IDs or mode.** The low-level helper therefore returns only a reconciliation signal. The integrated adapter additionally requires an unguessable HTTPS callback route capability derived from a protected secret and separated by Partner ID/mode. The URL is bound inside the vendor token payload, never sent as raw browser configuration. The adapter rejects JWT payloads exposing the literal private capability. Its confidentiality, the supplied vendor token override behavior, HTTPS and trusted ingress are essential assumptions; logs and dashboard access must protect it. HMAC alone remains insufficient.

Authenticated callback projections are encrypted and committed with the durable event/job before acknowledgement. Photos, private result/receipt URLs, ID numbers, address, contact and device/GPS data are not retained by this adapter. Mutable receipt URLs do not affect deduplication. Callback bodies never directly update customer eligibility: the worker must confirm the same current canonical job/user/status and the stored attempt's scope.

Smile ID retries three times after the initial attempt, immediately after failure/non-2xx, for four total attempts; a 2xx must arrive within 35 seconds. Order is not guaranteed. Owner/Admin registers environment-specific HTTPS callbacks in Developer → Security Settings → Callback URLs. See [setup](smile-id-setup.md) for the private helper, edge IPs and allowlisting. The app does not trust forwarded client IP headers.

## Decision and recovery policy

The supplied example combines clear with high risk, score 100 and populated indicators, despite a false fraud summary and clear Smile Secure. It also uses placeholder country XX. These are not approval evidence.

| Result                                                                                                                                | Handling                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Matching authenticated clear with complete extracted name/DOB/country, adult age, valid available dates and no supplied adverse fraud | Eligible for a sandbox/live identity decision in the stored mode; stage gates still apply |
| Clear with adverse/contradictory risk, missing identity, unknown reason or unexpected data                                            | Under review                                                                              |
| Underage or country mismatch                                                                                                          | Rejected with safe reason                                                                 |
| Known expiry/unreadable/unsupported-document reason                                                                                   | Correction required                                                                       |
| Block                                                                                                                                 | Rejected; no automatic blanket account restriction                                        |
| Attention/error without a known correction reason                                                                                     | Under review                                                                              |
| Canonical status and detailed callback disagree                                                                                       | Under review and durable replay recovery                                                  |
| Different authenticated cores or jobs for one attempt                                                                                 | Quarantined for review, including after an earlier approval                               |

Missing expiration is permitted for nonexpiring documents; an available expired date is rejected. Clear Document Verification is interpreted according to the supplied product contract as document authenticity/face/liveness success only after all independent checks pass. Unknown full schemas/dispositions do not receive synthetic approval flags.

There is no vendor revision in the supplied contract. Adapter revisions belong to encrypted local checkpoints and increment only when normalized content changes; provider timestamps/arrival order never order conflicting approvals. Retries reuse the stored operation. One replay intent is persisted per attempt/job/terminal disposition; expired running/uncertain replay dispatches are held rather than blindly repeated. Explicit support resolution and vendor finality/amendment semantics remain to establish for quarantined cases.

## Remaining vendor evidence

The adapter and browser integration are implemented behind explicit opt-in. Fixtures prove local behavior, not provider compatibility. Actual token multipart encoding, callback confidentiality/override, user/operation binding, 35-second ingress response, retry timestamp behavior, country/document entitlements and full sandbox outcomes remain to validate. Production privacy/retention, appeal handling and bank ownership integration are also outstanding. See [Task 3 status](task-3-implementation.md). Staging financial access stays disabled.
