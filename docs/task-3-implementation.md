# Task 3 implementation and provider handoff

Built 6 November 2026 on `feat/task-3-kyc-bank-verification`, based on main `e37e15a` and plan `5b9ab63`.

**Status: provider-neutral implementation, not completed provider integration.** The owner selected Smile ID for KYC on 7 November 2026 and has since reported access to Sandbox Credentials. Bank verification remains unselected. No live/sandbox vendor account, country coverage, price, contract eligibility or matching policy has been verified. The production provider registry is deliberately empty. Deployed screens therefore show verification unavailable and accept no identity or bank submissions. Test adapters exist only in automated test code and cannot be selected through an environment variable or HTTP request.

## Implemented

- `/identity`: authenticated overview, disclosure acknowledgment, hosted-capture handoff, persisted status, correction/resubmission and explicit unavailable/restricted states. Browser return never approves a customer. Open pages refresh after focus, visibility changes and every 15 seconds.
- `/banks`: identity/authenticator prerequisites, country-specific provider catalog/field contract, exact-operation MFA, encrypted immutable destination records, masked listings and ownership outcomes. No arbitrary customer-supplied owner name or verification flag is accepted. Retirement and editing are intentionally absent pending policy.
- Migration `004_identity_and_banks.sql`: current case plus attempts, protected destinations, immutable decision history, authenticated event inbox and durable operation jobs. Existing customers remain unverified; there is no synthetic migration approval.
- Server checks customer role, current session, verified email, restriction, country, age 18+, government ID and liveness evidence, current attempt, provider/mode and monotonic result revision. Ordinary rejection preserves its reason without restricting the whole account. Resubmissions keep prior evidence/history.
- Bank grants bind SHA-256 of the canonical JSON array `["bank_add", operationId, country, bankCode, accountNumber]`; details are strictly parsed/trimmed first. The existing keyed digest protects the stored grant. Grant consumption and destination/job creation share one transaction. Retrying the same committed operation returns its existing result; changing payload fails. Provider retries use the original operation ID.
- Provider webhook routes are registered only for configured adapters. They receive raw bytes before browser CSRF/JSON middleware; adapters must authenticate signature, signed timestamp, freshness and mode. All ordinary mutations retain Origin/custom-header checks. Events deduplicate durably and schedule canonical status lookup; webhook bodies never directly set approval.
- Worker leases recover from interruption, fence expired worker results and retain uncertain outcomes. Provider calls have a 30-second orchestration deadline; adapters must also bound/cancel their own network requests. Repeated starts use stable operation IDs, and canonical polling recovers missing webhooks. Failures use exponential retry delays and eventually surface a temporary issue; customer refresh safely requeues the same operation.
- BullMQ/Redis wakeups contain empty payloads. PostgreSQL owns operation identity, encrypted evidence, leases and outcomes. Startup and periodic scans recover work even if Redis loses queued wakeups. No private identity/bank details are written to Redis, browser storage, audit metadata or logs.
- Sandbox approval still cannot grant staging financial access. Hosted production additionally requires a current **live** approved identity, preventing a stage-flag change from promoting sandbox evidence. Existing financial capabilities remain disabled.
- Safe email delivery log categories distinguish authentication, timeout, connection, TLS and message/envelope errors without logging provider errors or credentials. The owner confirmed emails arrive slowly; no live SMTP cause was established or configuration changed.

## Actual structure

```text
apps/api/migrations/004_identity_and_banks.sql
apps/api/src/eligibility/eligibility.ts
apps/api/src/providers/verification.ts          # Vendor contract; empty deployed registry
apps/api/src/verification/verification.service.ts
apps/api/src/verification/verification.controller.ts
apps/api/src/verification/verification.worker.ts # Durable database work
apps/api/src/jobs/verification-queue.ts           # BullMQ wakeups
apps/api/src/worker.ts                           # Background worker entry
apps/customer/app/{identity,banks}/page.jsx
apps/customer/components/verification/VerificationApp.jsx
apps/customer/lib/api.js
apps/api/test/verification.test.ts
tests/customer-auth/verification.spec.js
```

The identity/bank UI is separate from `AccountApp.jsx` and shares its logo, theme and responsive account shell. Full bank details live only in form memory until submitted; persisted server responses are masked.

## Provider recommendation and decisions

**Smile ID is selected for KYC**, following the owner’s decision on 7 November 2026. The owner has since opened Sandbox Credentials; actual authenticated sandbox evidence is still needed. The official Node SDK and its examples have been inspected; the full documentation site is blocked by this workspace’s network policy. This establishes the SDK signing/token/status contracts, not country coverage, an account-enabled capture flow or verified outcomes. See [Smile ID setup and integration findings](smile-id-setup.md).

Treat bank ownership as a separate selection. A bank-account-name lookup alone is insufficient. Require verifiable evidence tied to the exact destination and verified identity, with an agreed matching policy. Do not assume an existing payment provider's contract covers crypto/P2P.

| Market             | KYC provider/documents/liveness | Bank schema and ownership evidence                            | Enabled now |
| ------------------ | ------------------------------- | ------------------------------------------------------------- | ----------- |
| Nigeria / NGN      | Smile ID selected; checks/documents unconfirmed     | Pending provider and matching policy                          | No          |
| Ghana / GHS        | Smile ID selected; checks/documents unconfirmed     | Pending country-specific bank schema and ownership capability | No          |
| South Africa / ZAR | Smile ID selected; checks/documents unconfirmed     | Pending country-specific bank schema and ownership capability | No          |
| Kenya / KES        | Smile ID selected; checks/documents unconfirmed     | Pending country-specific bank schema and ownership capability | No          |

Before enabling an adapter, record supported countries/documents, minimum fields, sandbox and live account eligibility, privacy/consent wording, retention/deletion responsibility, rejection/appeal path, name matching/joint/business-account rules and costs. Bank retirement policy remains undecided. No budget or launch date is assumed.

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

Migration 004 must run before the new API starts. Keep `NODE_ENV=production`, `DEPLOYMENT_STAGE=staging`, existing database/encryption key, email settings and customer `APP_ORIGIN`. Private `.env` files were neither read nor edited for this work. Customer Vercel still uses `API_INTERNAL_ORIGIN=https://zetmond-wallet.onrender.com`; redeploy the customer app to publish the new screens.

The new optional **secret** setting is `REDIS_URL` (a credential-bearing `redis://` or `rediss://` service URL). It is not needed for the current empty provider registry or existing email delivery. Once providers and Redis hosting are chosen, use a dedicated Render background worker with the same repository/root/build command and this start command:

```sh
node apps/api/dist/worker.js
```

Share the appropriate staging database, encryption key and provider configuration with that worker. Apply migrations through the API deployment first. Use Redis with a `noeviction` policy and provider-appropriate persistence/availability. Redis credentials stay server-side. The worker deliberately exits with an explanatory message when no providers are configured; **do not provision a continuously restarting Render worker before an adapter is selected**.

`SMILE_ID_PARTNER_ID`, `SMILE_ID_API_KEY` and `SMILE_ID_MODE=sandbox` now configure a server-only V3 token-authentication client, with short-lived token caching and an owner-operated credential check. The preliminary V1 methods have been replaced; the client is not yet an active capture/decision adapter. See [Smile ID setup](smile-id-setup.md) for credential storage and remaining contracts. No hosted worker/Redis service was created, no Vercel/Render deployment triggered, and no live KYC collection enabled by this branch.

## Validation and remaining evidence

Results: **41 backend tests and 13 browser tests passed**, including the local Redis recovery test. API TypeScript and customer production builds passed; the updated dependency lockfile passed a frozen install. These results do not establish a vendor integration or live deployment.

Build follow-up, 7 November 2026: a fresh `CI=1 pnpm install --frozen-lockfile` reproduced `ERR_PNPM_IGNORED_BUILDS` for BullMQ's transitive `msgpackr-extract@3.0.7`. The earlier install used `--ignore-scripts`, which missed this failure. `pnpm-workspace.yaml` now explicitly sets `allowBuilds.msgpackr-extract: false`, skipping that optional native build while retaining pnpm's checks and the existing Argon2/esbuild permissions. A clean install with scripts enabled passed. The normal `pnpm build:auth` and `pnpm build` commands passed with Turbopack. All 41 backend tests passed with `MSGPACKR_NATIVE_ACCELERATION_DISABLED=true`, including Redis/BullMQ recovery, and all 13 customer plus 8 marketing browser tests passed using installed Chromium in the isolated workspace. GitHub Actions and Vercel logs were blocked by this workspace's network policy, so this reproduces the repository failure locally rather than confirming the remote deployments.

Automated tests use only a dedicated local PostgreSQL database whose name ends in `_test`, and temporary local Redis. Private environment files are excluded from the isolated build/test workspace.

- Backend tests cover duplicate submissions, uncertain provider outcomes, restarted/expired leases, authenticated raw-byte callbacks, duplicate/expired/forged events, missing ID evidence, underage and country rejection, correction history, stale results, restrictions, exact bank MFA, encrypted records, owner isolation, bank mismatch and stage promotion.
- Redis integration test destroys only its unique test queue, restarts the BullMQ worker and proves PostgreSQL work is recovered. CI provisions Redis and runs this test with `TEST_REDIS_URL`; it is explicitly skipped if the optional local Redis test URL is absent.
- Browser tests exercise real unconfigured-provider screens at 320/390/768/1440 widths, light/dark appearance, UI contract fixtures for disclosure/review/correction/bank forms, masked results, accessible errors and revoked-session redirects. Fixtures are labeled in test code; they are **not vendor sandbox evidence**.
- Task 2 authentication/API/browser regressions and API/customer production builds are included.

Actual vendor-backed capture, verification, recovery and bank ownership demonstrations are outstanding. Task 3 must not be marked complete until those pass for the enabled markets and outstanding policies are resolved. Vault remains Task 9 (second to last); admin portal Task 10 (last).
