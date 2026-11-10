# Smile ID setup for Task 3

The Smile ID V3 adapter and V12 browser capture journey are implemented behind `SMILE_ID_ENABLED`. Credentials alone do not enable capture. The default remains disabled until the owner deploys the changes and registers the private callback. Bank ownership verification is a separate, unfinished integration.

No real Smile ID authentication, camera capture or callback has been demonstrated by the agent. Automated checks intercept provider requests. The owner's private `.env` was neither read nor changed.

## Render rollout

Deploy this branch's reviewed code and migration `005_smile_id_capture.sql` before enabling capture. Keep the existing database and encryption key. The repository root stays blank and the commands remain:

```sh
corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm --filter @zetmond/api build
node apps/api/dist/migrate.js && node apps/api/dist/main.js
```

In **Render → zetmond-wallet → Environment**, use:

| Setting                      | Value or purpose                                                                            | Config or secret |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ---------------- |
| `NODE_ENV`                   | `production`                                                                                | Config           |
| `DEPLOYMENT_STAGE`           | `staging` while validating sandbox                                                          | Config           |
| `APP_ORIGIN`                 | `https://zetmond.vercel.app`                                                                | Config           |
| `PUBLIC_API_ORIGIN`          | `https://zetmond-wallet.onrender.com`, no trailing slash                                    | Config           |
| `SMILE_ID_PARTNER_ID`        | Existing numeric Partner ID                                                                 | Config           |
| `SMILE_ID_API_KEY`           | Existing sandbox API key                                                                    | Secret           |
| `SMILE_ID_MODE`              | `sandbox`                                                                                   | Config           |
| `SMILE_ID_ENABLED`           | Initially `false`; set `true` after callback registration                                   | Config           |
| `VERIFICATION_INLINE_WORKER` | `true` (default)                                                                            | Config           |
| `SMILE_ID_WEBHOOK_SECRET`    | Optional 64-character random hex secret; otherwise derived from the existing encryption key | Secret           |
| `SMILE_ID_PREVIOUS_API_KEY`  | Optional previous key during rotation of existing attempts                                  | Secret           |

Preserve working email settings. A staging notice at `/policies` is used if `PRIVACY_URL` is absent in sandbox; it is not an approved production privacy policy. Production requires the existing approved-policy checks and live provider credentials. Do not change the stage flag to promote sandbox results.

### Register the callback

1. In the deployed service's owner-only terminal, run:

   ```sh
   node apps/api/dist/print-smile-callback.js
   ```

   This prints the mode and **private callback URL**. Treat the complete URL as a credential: do not paste it in chat, source control, tickets, screenshots or public logs.

2. In Smile ID, select **Sandbox → Developer → Security Settings → Callback URLs**. An Owner or Admin can register the printed HTTPS URL. Enable callback URL allowlisting for that URL/domain as supported by the dashboard.
3. Keep the encryption key and optional callback secret stable while attempts are outstanding. Changing either changes the route and requires deliberate migration/registration; it must not be used to reset a stuck verification.
4. Set `SMILE_ID_ENABLED=true` and redeploy the API. Existing API health remains `/api/health`.
5. Redeploy the customer Vercel app with `API_INTERNAL_ORIGIN=https://zetmond-wallet.onrender.com`, then open `/identity` as an email-verified customer.

A Render Shell is required for the owner-only helper. If the service plan has no shell, run it from a protected terminal using the same service environment; never add a public endpoint for it.

The customer receives only the non-secret callback alias. The private callback URL is bound into the vendor token payload and, per the supplied Token API contract, becomes an opaque `callback_` reference. Tokens containing the literal private capability are rejected before browser delivery. Confirm the binding and override behavior in a real sandbox run before enabling live verification.

### Inbound network allowlisting

If a trusted edge firewall restricts incoming traffic, the supplied Smile ID documentation lists:

| Environment | Callback source IPs                                                |
| ----------- | ------------------------------------------------------------------ |
| Sandbox     | `13.48.228.158`, `16.170.104.93`, `54.246.37.255`, `99.81.237.141` |
| Production  | `13.51.0.119`, `34.240.137.52`, `51.20.27.3`, `52.213.46.74`       |

Confirm current addresses before configuring the edge. Application code does not trust client `X-Forwarded-For` headers or claim IP allowlisting is configured. HTTPS, the private route capability, timestamp proof, stored credential/mode/subject and canonical job lookup protect callback intake.

## Processing and recovery

- `/identity` records the actual disclosure version, URL and acknowledgement time before creating a durable attempt. `/identity/capture` loads the vendor script only when the customer starts capture.
- Authenticated `POST /api/identity/capture` accepts only an attempt ID. The API derives country, verified email, stable provider subject, product, callback and consent from the current owned attempt. Tokens are encrypted at rest and resume after API restart. A lease prevents parallel token issuance; an expired or uncertain issued session cannot mint another verification automatically.
- The V12 SDK uses `doc_verification`, while the token/REST/webhook product is `document_verification`. SDK mode maps `live` to `production`. All five branding fields are supplied. Document/selfie/liveness collection stays with Smile ID; no API key or cached lookup token reaches the browser.
- Browser success is submission feedback only. An optional job/user hint is untrusted and cannot approve identity. Unknown submission outcomes stop automatic retries.
- The callback's HMAC covers timestamp + Partner ID + `sid_request`, **not JSON**. The private callback capability is an independent secret, hidden from browser tokens. The adapter validates both, correlates the stored user/attempt/mode/original key, and durably stores an encrypted minimal projection before acknowledging. It never logs the body or persists photos, receipts, device/GPS data or ID numbers.
- A worker obtains matching canonical job status before applying the projected evidence. Clear status alone cannot approve: name, DOB, country, adult age, document validity and absence of supplied adverse fraud signals are checked. The supplied clear/high-risk example remains under review. Missing or unsupported data cannot approve.
- No vendor revision exists in the supplied status contract. Local revisions advance only on a changed normalized checkpoint. Different authenticated cores, including different jobs for one attempt, are quarantined for review rather than ordered by arrival time. Ordinary duplicate deliveries and changed receipt links do not change a decision.
- Missing detailed callbacks create one durable replay intent for each attempt/job/terminal disposition. Replay requests are not verification submissions. A lost replay response is recorded as unknown and never blindly sent again; unresolved work stays under review.

The API runs a separate verification pump every second, independent of email delivery. PostgreSQL owns the queue, leases and evidence. **Redis and another Render service are not required for the initial rollout.** For a later dedicated worker, configure `REDIS_URL`, use `node apps/api/dist/worker.js`, and set API `VERIFICATION_INLINE_WORKER=false`. Apply migrations first and share the correct database/key/provider settings. BullMQ carries only wakeups, not customer evidence.

## Credential check and sandbox acceptance

An owner can run `node apps/api/dist/check-smile-id.js` to check token authentication without printing a key/token or submitting identity evidence. It does not prove the complete capture journey works.

Before marking the KYC integration accepted:

- Prove the token's multipart object encoding, subject/country/callback bindings and opaque callback reference with the actual account.
- Complete the vendor-supported sandbox capture using approved test data, including consent, front/back document handling, selfie and liveness. Do not fabricate liveness frames.
- Confirm the callback reaches the private URL and the server reaches the expected persisted result after reload/API restart.
- Exercise rejection, correction, cancellation, missing/duplicate callback and mismatched/fraud evidence. Confirm staging financial access stays denied.
- Confirm supported documents, required checks and account entitlements for NG/GH/ZA/KE before enabling each market. Unknown attention/error shapes remain under review; they are not approval evidence.
- Select a bank ownership provider and approve country-specific matching/retirement policies. KYC success does not verify a bank account.

The public contracts and trust limitations are recorded in [V3 contract review](smile-id-v3-contract.md), [hosted web contract](smile-id-web-sdk-contract.md), and the [Token API snapshot](contracts/smile-id-v3-token.openapi.json). Documentation text does not authorize policy approval, live deployment or external messages.
