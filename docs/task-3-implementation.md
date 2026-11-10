# Task 3 implementation and provider handoff

Built 6 November 2026 on `feat/task-3-kyc-bank-verification`, based on main `e37e15a` and plan `5b9ab63`.

**Status: Smile ID adapter and browser capture implemented; account-backed sandbox acceptance and bank integration remain outstanding.** The owner selected Smile ID for KYC and reported saving sandbox credentials in Render. The real adapter now has explicit `SMILE_ID_ENABLED` opt-in, default false. Deploying credentials alone keeps the unavailable state. Test adapters remain confined to automated tests and cannot be selected by environment or HTTP. The owner now targets delivery within five days; no full-scope production completion is asserted by this status.

## Launch markets and bank-provider follow-up

The owner removed South Africa on 9 November 2026. Nigeria/NGN, Ghana/GHS and Kenya/KES are now the only supported launch markets. A shared server market catalog drives signup metadata, registration, provisioning, verification schemas and provider eligibility. New ZA registrations, identity sessions and bank details are refused. Prior ZA records remain stored; sign-in/profile access remains available while verification, saved destination usability and financial access are denied. Old migrations remain unchanged so historical rows are readable. Queued work cannot initiate or apply an approval for a removed market.

The owner reported opening the deployed verification page but had no identity document available to complete the flow. Record this as an owner-reported UI check only; document/liveness completion, callback delivery and final saved verification result remain unproven. Full Smile ID sandbox acceptance stays pending.

Read [bank-provider research](task-3-bank-provider-review.md) for the inspected official SDKs, account-connection recommendation and country/ownership/business-eligibility gaps. No bank provider has been selected or activated by that research.

## Implemented

- `/identity`: authenticated overview, disclosure acknowledgment, hosted-capture handoff, persisted status, correction/resubmission and explicit unavailable/restricted states. Browser return never approves a customer. Open pages refresh after focus, visibility changes and every 15 seconds.
- `/banks`: identity/authenticator prerequisites, country-specific provider catalog/field contract, exact-operation MFA, encrypted immutable destination records, masked listings and ownership outcomes. No arbitrary customer-supplied owner name or verification flag is accepted. Retirement and editing are intentionally absent pending policy.
- Migrations `004_identity_and_banks.sql`, `005_smile_id_capture.sql` and `006_bank_ownership_policy.sql`: current case plus attempts, protected destinations, immutable decision history, authenticated event inbox and durable operation jobs. Existing customers remain unverified; there is no synthetic migration approval.
- Server checks customer role, current session, verified email, restriction, country, age 18+, government ID and liveness evidence, current attempt, provider/mode and monotonic result revision. Ordinary rejection preserves its reason without restricting the whole account. Resubmissions keep prior evidence/history.
- Bank grants bind SHA-256 of the canonical JSON array `["bank_add", operationId, country, bankCode, accountNumber]`; details are strictly parsed/trimmed first. The existing keyed digest protects the stored grant. Grant consumption and destination/job creation share one transaction. Retrying the same committed operation returns its existing result; changing payload fails. Provider retries use the original operation ID.
- Provider webhook routes are registered only for configured adapters. They receive raw bytes before browser CSRF/JSON middleware; adapters must authenticate signature, signed timestamp, freshness and mode. All ordinary mutations retain Origin/custom-header checks. Events deduplicate durably and schedule canonical status lookup; webhook bodies never directly set approval.
- Worker leases recover from interruption, fence expired worker results and retain uncertain outcomes. Provider calls have a 30-second orchestration deadline; adapters must also bound/cancel their own network requests. Repeated starts use stable operation IDs, and canonical polling recovers missing webhooks. Failures use exponential retry delays and eventually surface a temporary issue; customer refresh safely requeues the same operation.
- A separate API verification pump runs every second by default, independent of email delivery; initial rollout needs no Redis or extra Render worker. Optional BullMQ/Redis wakeups contain empty payloads. PostgreSQL owns operation identity, encrypted evidence, leases and outcomes. Startup and periodic scans recover work even if Redis loses queued wakeups. No private identity/bank details are written to Redis, browser storage, audit metadata or logs.
- Sandbox approval still cannot grant staging financial access. Hosted production additionally requires a current **live** approved identity, preventing a stage-flag change from promoting sandbox evidence. Existing financial capabilities remain disabled.
- Safe email delivery log categories distinguish authentication, timeout, connection, TLS and message/envelope errors without logging provider errors or credentials. The owner confirmed emails arrive slowly; no live SMTP cause was established or configuration changed.

## Actual structure

```text
apps/api/migrations/{004_identity_and_banks,005_smile_id_capture,006_bank_ownership_policy}.sql
apps/api/src/eligibility/eligibility.ts
apps/api/src/providers/verification.ts          # Provider contract
apps/api/src/providers/registry.ts              # Real adapter, explicit opt-in
apps/api/src/providers/smile-id.provider.ts      # Durable capture/reconciliation
apps/api/src/providers/smile-id.result.ts        # Minimal callback projection/checks
apps/api/src/providers/smile-id.settings.ts      # Private callback capability
apps/api/src/print-smile-callback.ts             # Owner-only registration helper
apps/api/src/verification/verification.service.ts
apps/api/src/verification/verification.controller.ts
apps/api/src/verification/verification.worker.ts # Durable database work
apps/api/src/verification/bank-ownership-policy.ts # Independent holder-name review gate
apps/api/src/jobs/verification-queue.ts           # BullMQ wakeups
apps/api/src/worker.ts                           # Background worker entry
apps/customer/app/{identity,banks}/page.jsx
apps/customer/app/identity/capture/page.jsx
apps/customer/components/verification/SmileCapture.jsx
apps/customer/lib/smile-id-sdk.js
apps/customer/components/verification/VerificationApp.jsx
apps/customer/lib/api.js
apps/api/test/verification.test.ts
apps/api/test/smile-id-integration.test.ts
tests/customer-auth/verification.spec.js
tests/customer-auth/smile-capture.spec.js
```

The identity/bank UI is separate from `AccountApp.jsx` and shares its logo, theme and responsive account shell. Full bank details live only in form memory until submitted; persisted server responses are masked.

## Provider recommendation and decisions

**Smile ID is selected for KYC**, following the owner’s decision on 7 November 2026. The owner has since opened Sandbox Credentials; actual authenticated sandbox evidence is still needed. The official Node SDK and its examples have been inspected; the full documentation site is blocked by this workspace’s network policy. The implementation follows the supplied current V3/V12 contracts; real account-enabled capture, country coverage and verified outcomes still need demonstration. See [Smile ID setup and integration findings](smile-id-setup.md).

Treat bank ownership as a separate selection. A bank-account-name lookup alone is insufficient. Require verifiable evidence tied to the exact destination and verified identity, with an agreed matching policy. Do not assume an existing payment provider's contract covers crypto/P2P.

| Market        | KYC provider/documents/liveness                 | Bank schema and ownership evidence                            | Enabled now |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------- | ----------- |
| Nigeria / NGN | Smile ID selected; checks/documents unconfirmed | Pending provider and matching policy                          | No          |
| Ghana / GHS   | Smile ID selected; checks/documents unconfirmed | Pending country-specific bank schema and ownership capability | No          |
| Kenya / KES   | Smile ID selected; checks/documents unconfirmed | Pending country-specific bank schema and ownership capability | No          |

Before enabling a market for real customers, record supported countries/documents, minimum fields, sandbox and live account eligibility, privacy/consent wording, retention/deletion responsibility, rejection/appeal path, name matching/joint/business-account rules and costs. Bank retirement policy remains undecided. No budget is assumed; the owner has now stated a five-day delivery target.

Adapter requirements in `src/providers/verification.ts` are an internal contract, **not a fabricated vendor API**. Implement the selected vendor's actual endpoints, authentication/signatures, response validation, API timeouts and safe error mapping. In particular:

1. Bind sessions/results to the supplied persisted operation ID and the configured provider mode. Guarantee idempotent create/recover semantics, including uncertain HTTP outcomes, before retrying any chargeable operation.
2. Obtain canonical authenticated status and a reliable monotonic revision; arrival time is not a revision. If the vendor lacks versioned status, implement its documented reconciliation strategy before activation.
3. Return only vetted HTTPS capture origins and safe machine-readable reasons. Refresh an expired capture session against the same operation. Never accept approval from a redirect.
4. Return trusted age/country/ID/liveness evidence and bank ownership/matching evidence bound to destination fingerprint, identity attempt and approved policy version. A typed name, provider lookup alone or universal `nameMatch=true` is not sufficient.
5. Verify raw webhook signatures/timestamps and replay freshness before returning an event ID. Events never carry trusted status into the domain service. Add vendor-specific contract tests and actual sandbox journeys for each enabled market.
6. Separate sandbox/live data and credentials. Enable only the countries whose required checks have been evidenced. Add configuration through protected Render settings; never commit keys.

## Render rollout

The web API build/start commands remain unchanged:

```sh
corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm --filter @zetmond/api build
node apps/api/dist/migrate.js && node apps/api/dist/main.js
```

Migrations 004, 005 and 006 must run before the new API starts. The existing start command applies them automatically; no paid Render Shell is required. Migration 006 retains historical records with null policy pins, which cannot be used until freshly verified under a current policy. Keep `NODE_ENV=production`, `DEPLOYMENT_STAGE=staging`, existing database/encryption key, email settings and customer `APP_ORIGIN`. Private `.env` files were neither read nor edited for this work. Customer Vercel still uses `API_INTERNAL_ORIGIN=https://zetmond-wallet.onrender.com`; redeploy the customer app to publish the new screens.

The [Smile ID setup guide](smile-id-setup.md) gives the exact configuration and private callback registration steps. Add public `PUBLIC_API_ORIGIN=https://zetmond-wallet.onrender.com`, retain sandbox credentials/mode, register the owner-helper's private URL in Smile ID, then explicitly enable `SMILE_ID_ENABLED=true`. The private callback URL and API keys are secrets; the URL must not be shared in chat or exposed by a public endpoint. The default API pump processes PostgreSQL jobs independently of SMTP.

Redis is optional for this rollout. To move processing to a separate Render background worker later, configure protected `REDIS_URL`, share the correct database/key/provider settings, start `node apps/api/dist/worker.js`, and set the API's `VERIFICATION_INLINE_WORKER=false`. Apply migrations first and use Redis with no eviction and suitable persistence. The worker exits when no provider is configured.

## Validation and remaining evidence

Results: **41 backend tests and 13 browser tests passed**, including the local Redis recovery test. API TypeScript and customer production builds passed; the updated dependency lockfile passed a frozen install. These results do not establish a vendor integration or live deployment.

Build follow-up, 7 November 2026: a fresh `CI=1 pnpm install --frozen-lockfile` reproduced `ERR_PNPM_IGNORED_BUILDS` for BullMQ's transitive `msgpackr-extract@3.0.7`. The earlier install used `--ignore-scripts`, which missed this failure. `pnpm-workspace.yaml` now explicitly sets `allowBuilds.msgpackr-extract: false`, skipping that optional native build while retaining pnpm's checks and the existing Argon2/esbuild permissions. A clean install with scripts enabled passed. The normal `pnpm build:auth` and `pnpm build` commands passed with Turbopack. All 41 backend tests passed with `MSGPACKR_NATIVE_ACCELERATION_DISABLED=true`, including Redis/BullMQ recovery, and all 13 customer plus 8 marketing browser tests passed using installed Chromium in the isolated workspace. GitHub Actions and Vercel logs were blocked by this workspace's network policy, so this reproduces the repository failure locally rather than confirming the remote deployments.

Smile ID integration follow-up: the isolated API TypeScript and customer production builds passed. The final API run has **136 checks: 135 passed, one optional Redis check skipped**. This includes 81 transport checks and 14 connected Smile ID checks for ownership/CSRF, concurrent issuance, encrypted restart recovery, private-token disclosure rejection, callback proof/capability, duplicates/conflicts, correction history, age/country/expiry/fraud, missing-result replay and original-key rotation. The final customer browser coverage is **20 passed across the regression and corrected capture runs**: 13 existing account/verification cases plus seven new capture cases. The new cases cover submission-only feedback, duplicate/stale callbacks, cancellation, denied consent, safe uncertain outcomes, expired login, SDK load failure and responsive light/dark screens at 320/390/768/1440 widths.

The implementation persists actual disclosure acknowledgements, encrypted session tokens and minimal authenticated callback evidence. Browser tokens are isolated from cached server lookup tokens. The documented HMAC does not cover JSON, so a private capability URL hidden through the supplied token callback-reference mechanism is also required. The worker independently confirms canonical status and current scope before applying identity evidence. Conflicting authenticated cores are held for review; local checkpoint revisions never order provider results by arrival time. Staging and sandbox-to-production financial gates remain intact.

These are fixture-based integration checks and local browser tests. They do not establish real token field enforcement, callback secrecy/override, vendor camera/liveness, country entitlements or deployed results. The actual sandbox acceptance checklist and remaining contract assumptions are documented in [setup](smile-id-setup.md), [V3 review](smile-id-v3-contract.md) and [hosted web contract](smile-id-web-sdk-contract.md).

Automated tests use only a dedicated local PostgreSQL database whose name ends in `_test`, and, in earlier Redis-specific runs, temporary local Redis. Private environment files are excluded from the isolated build/test workspace.

- Backend tests cover duplicate submissions, uncertain provider outcomes, restarted/expired leases, authenticated raw-byte callbacks, duplicate/expired/forged events, missing ID evidence, underage and country rejection, correction history, stale results, restrictions, exact bank MFA, encrypted records, owner isolation, bank mismatch and stage promotion.
- Redis integration test destroys only its unique test queue, restarts the BullMQ worker and proves PostgreSQL work is recovered. CI provisions Redis and runs this test with `TEST_REDIS_URL`; it is explicitly skipped if the optional local Redis test URL is absent.
- Browser tests exercise real unconfigured-provider screens at 320/390/768/1440 widths, light/dark appearance, UI contract fixtures for disclosure/review/correction/bank forms, masked results, accessible errors and revoked-session redirects. Fixtures are labeled in test code; they are **not vendor sandbox evidence**.
- Task 2 authentication/API/browser regressions and API/customer production builds are included.

Three-country scope follow-up, 9 November 2026: **139 backend checks ran: 138 passed and the optional Redis check was skipped; all 22 customer browser checks passed.** API TypeScript and customer production builds passed. Coverage includes successful NG/GH/KE registration and local currencies, rejected ZA registration and outbound token/document requests, preserved unsupported-country sign-in/profile access with financial/verification denial, and skipped queued work for a removed account or attempt country. Historical migration checks remain unchanged; no database rewrite is needed. No private `.env` was read or modified. Provider calls remain fixtures, and no bank provider is active.

Bank ownership follow-up, 9 November 2026: independent comparison of the provider's holder name against current encrypted KYC evidence and destination-owned provider/local policy pins are implemented. Conflicting names go to review; a later authenticated revision must pass the checks again. Policy changes stop external work and cannot silently promote old records. The customer sees review/renewal states, while names and full account data remain private. These are prepared domain protections, not an active bank integration. See the [bank-provider review](task-3-bank-provider-review.md) for the current-contract network blocker and remaining provider/reverification work.

Bank-policy validation: API TypeScript and customer production builds passed. **146 backend checks ran: 145 passed, one optional Redis check skipped. All 23 browser cases passed across the full run and the targeted MFA/bank-review rerun.** The admin browser test now avoids generating a TOTP immediately before expiry; server MFA validation is unchanged. Current Mono documentation access remains blocked by the cloud network policy; the saved, unactivated public-domain draft and exact remaining provider contracts are documented in the bank review. No private `.env` was read or modified, no paid service was opened and no bank provider was activated.

Actual vendor-backed capture, verification, recovery and bank ownership demonstrations are outstanding. Task 3 must not be marked complete until those pass for the enabled markets and outstanding policies are resolved. Vault remains Task 9 (second to last); admin portal Task 10 (last).
