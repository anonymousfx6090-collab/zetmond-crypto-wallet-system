# Task 3 — KYC and bank verification plan

**Current launch scope — owner-directed 11 November 2026:** Nigeria/NGN only. Ghana and Kenya stay visible as coming-soon choices, show “Zetmond is not available in your country yet” when selected, and cannot register or obtain verification/financial access. Preserve historical records and sign-in. Earlier three-country planning below is retained as future integration research. Monnify is now evaluated for Nigerian bank verification; no bank provider has been activated.

Status: identity/bank records, APIs, screens and durable processing are implemented. The Smile ID V3 adapter and V12 capture journey were merged in PR #7. The owner reported opening the deployed verification page but could not complete a document check; full sandbox capture and callback evidence remain outstanding. Bank-provider selection and integration are unfinished. The 9 November 2026 launch-market change limits support to Nigeria, Ghana and Kenya. See [implementation and handoff](task-3-implementation.md).

This plan follows PRD v1.1 Sections 4, 7.4–7.5, 13.3, 16.7, 17.4 and 21.1, and decisions O01, O19, O20, O22, O25 and O26. O19 now selects Smile ID for KYC. Bank-provider selection, country/document coverage and other policies marked TBD in that PRD remain undecided.

## Goal and existing foundation

Customers can complete identity verification, see verified outcomes and correction requests, and add bank destinations whose ownership is verified. The backend enforces eligibility and ownership on every relevant request.

Task 2 supplies registration, shared customer/admin login, email-only verification, MFA, session management, PostgreSQL migrations, audit events, encrypted delivery records and financial-eligibility checks. Start from `main` at `e37e15a` (PR #5), which includes staging implementation `319b367`. That baseline passed 24 backend tests and 9 customer browser tests. The owner confirmed Render staging health and reported receiving the test email. Task 3 extends the current Zetmond logo, purple styling, light/dark themes and responsive account layout.

Current hosts are `https://zetmond.vercel.app` for customers and `https://zetmond-wallet.onrender.com` for APIs. Hosting details and remaining live checks are documented in [Render staging setup](render-staging.md). Operator details, final notices and production policy approvals remain pending.

The foundation was developed on `feat/task-3-kyc-bank-verification`; the Smile ID follow-up was merged from `feat/smile-id-client`. The launch-market follow-up is on `feat/task-3-launch-markets`. The sections below retain the delivery requirements; the linked implementation document distinguishes completed code from outstanding provider work.

Launch markets are Nigeria/NGN, Ghana/GHS and Kenya/KES only, following the owner's 9 November 2026 removal of South Africa. Customers must be at least 18 and complete government-ID plus selfie/liveness verification. Email verification is required; phone numbers remain contact data and do not require SMS verification.

## Staging boundaries

- Keep `NODE_ENV=production` and `DEPLOYMENT_STAGE=staging` on Render, preserving HTTPS, secure cookies, email verification, MFA and authorization.
- Use provider sandboxes and test identities/bank details. Live identity collection requires the applicable provider agreement, privacy disclosures and evidence-handling decisions.
- Keep the backend staging financial-access denial even when a sandbox KYC case is approved. Identity and bank-management APIs need their own permission checks so that financial restrictions do not block testing verification itself.
- Do not change the owner's private `.env`. Document new variable names in examples/setup instructions and configure actual provider secrets through protected service settings.
- The owner intends the full product for customer launch. Task 3 does not enable wallet funding, withdrawals, P2P settlement or Vault functionality. Vault remains Task 9 and admin remains Task 10.

## Delivery sequence

### 3.1 — Complete Smile ID setup, choose bank verification and resolve integration rules

Create the selected Smile ID account and obtain sandbox access, following [Smile ID setup](smile-id-setup.md). Validate Smile ID and candidate bank-verification providers against a country-by-country capability matrix. Confirm supported documents, liveness, age verification, bank identifiers, account-name/ownership evidence, authenticated results, status lookup, retries, pricing, data handling and eligibility to serve Zetmond's disclosed business.

Prefer provider-hosted identity capture to minimize locally held documents. A bank lookup or a typed account-holder name alone must not establish ownership.

Record the decision matrix before committing to an integration:

| Market        | ID documents and selfie/liveness                       | Bank identifiers and ownership evidence                    | Provider sandbox, authenticated results and business eligibility |
| ------------- | ------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| Nigeria / NGN | TBD; confirm supported government IDs and age evidence | TBD; confirm bank lookup and verified ownership capability | TBD                                                              |
| Ghana / GHS   | TBD; confirm supported government IDs and age evidence | TBD; use the provider's Ghana-specific bank schema         | TBD                                                              |
| Kenya / KES   | TBD; confirm supported government IDs and age evidence | TBD; use the provider's Kenya-specific bank schema         | TBD                                                              |

Use current official documentation, account capabilities and sandbox evidence to fill this matrix. Smile ID is selected for KYC; no price or country coverage has been confirmed, and no bank-verification provider has been selected. KYC and bank verification can use different providers. The [bank-provider review](task-3-bank-provider-review.md) records inspected public SDKs and current gaps. Bank verification is separate from choosing a fiat collection/payout provider; a standard Monnify contract must not be assumed eligible for Zetmond's crypto/P2P model.

Before the affected integration is activated, resolve:

- Selected provider(s), sandbox credentials, webhook configuration and eligible country coverage.
- Accepted documents, required customer fields and consent/disclosure wording per country.
- Bank-name matching rules, joint/business-account treatment and mismatch resolution.
- Correction, rejection, reverification and restriction handling, including a permitted support/appeal path.
- Retention/deletion responsibilities and bank retirement/removal policy.

Provider adapters, schema and screens can progress before credentials are available. Completion requires actual provider-backed verification evidence; unsupported countries or missing integrations must remain clearly unavailable.

### 3.2 — Durable verification records

Add additive PostgreSQL migrations for identity profiles, KYC cases/attempts and decision history, bank destinations and verification attempts, and a provider-event inbox. Keep sensitive identity/bank fields encrypted and retain minimal provider references where possible.

Represent the full workflow on KYC cases and attempts. Keep the existing `users.kyc_status` as a compatible eligibility projection, updated atomically with verified decisions. Derive detailed customer labels/actions from case state so a rejection or correction is not misleadingly presented as ordinary review. Keep provider availability and account restrictions distinct from the case outcome; ordinary rejection must not silently become an account restriction. Preserve prior decisions and link resubmissions to their original case.

Use explicit state transitions, operation identifiers, ownership constraints and audit records. Bank records must support immutable destination versions so later trade snapshots cannot be redirected by a profile edit.

### 3.3 — KYC backend integration

Implement authenticated APIs to read status, start/resume verification and request permitted corrections. Validate country and age using trusted provider evidence. Bind each provider session and result to the correct customer and attempt.

Support not-started, incomplete, submitting, under-review, approved, correction-required and rejected outcomes, with separate unavailable/restricted explanations. A browser return from provider capture is not approval: the backend verifies the result.

Provider webhooks need their own source authentication and signature/raw-body handling; they cannot use the current browser-only Origin/custom-header check. Persist authenticated events durably, deduplicate deliveries and reconcile canonical provider status before applying conflicting or out-of-order results. Add recoverable background processing using the approved Redis/BullMQ stack with PostgreSQL as the durable source of work and results.

Scope webhook routing to configured providers and preserve raw bytes before JSON parsing where signatures require them. Keep the existing browser Origin/custom-header checks on all ordinary mutation routes. Bind results to provider mode, customer, case and current attempt; stale results must not approve a newer rejected/restricted case. Persist external-operation intent and stable references before submission, and recover an unknown provider outcome before retrying a chargeable operation.

### 3.4 — Bank destination verification

Implement country-specific bank lists/identifiers and an authenticated add/verify/list flow. Compare provider-confirmed ownership against the verified identity using the selected matching policy. Show pending, verified, mismatch, unavailable and inactive states with masked account details.

Extend Task 2's operation-bound MFA grants for sensitive destination changes. Consume authorization for the exact change in the same database transaction. Protect every bank record by customer ownership, and preserve verification history when a destination is retired under the agreed policy.

Add explicit bank-operation purposes to the existing step-up allowlist; bind authorization to the validated bank payload/destination version. Require authenticator enrollment when needed. Store the pending operation and consume its grant atomically; provider retries reuse that operation rather than replaying authorization. Do not edit verified account numbers in place. Retirement stays unavailable until its policy is resolved and must never delete destination evidence or break an active obligation.

### 3.5 — Customer screens

- Identity overview: requirements, current state and start/resume action.
- Verification flow: provider-hosted capture, return/status recovery and permitted corrections.
- Outcome screens: approval, actionable correction, rejection/restriction and provider outage.
- Banks: list, add, verification result and protected destination-management actions.
- Account overview: replace the identity-verification placeholder with real progress and next actions.

Use a step panel with guidance on desktop and one clear step per screen on mobile. Provide the provider-supported camera/file alternatives. Recover status after reload, login or browser suspension without creating duplicate submissions. Never store identity evidence or full bank details in browser storage or analytics.

### 3.6 — Eligibility enforcement

Create reusable backend eligibility checks using current account, contact, KYC and restriction records. Base customer eligibility requires verified email, approved KYC and no disqualifying restriction. Verified bank ownership is an additional requirement for relevant payout/advertiser operations; it is not automatically a prerequisite for every wallet action. MFA requirements remain specific to sensitive actions.

Refresh displayed status in open sessions and recheck permission when an operation executes. A later restriction or KYC change must preserve existing records and financial obligations. Task 3 establishes these checks; financial capabilities become available only through their later implementation tasks and release gates.

Separate checks for identity submission, bank management and financial actions. Starting KYC requires an eligible authenticated customer with verified email, not already-approved KYC. Bank verification requires the approved identity and applicable MFA. The existing staging financial guard remains authoritative: an approved sandbox case must still report `financialAccess=false` and financial APIs must reject access.

### 3.7 — Verification and handoff

- PostgreSQL integration tests for ownership, valid transitions, encrypted records and restart recovery.
- Provider-contract tests for authentic results, forged/replayed events, duplicate submissions, late/conflicting results and unavailable providers.
- Age/country/document validation, correction/resubmission, bank mismatch and exact-operation MFA tests.
- Direct API tests showing that unapproved or restricted users cannot bypass eligibility, and one customer cannot access another's bank or identity case.
- Browser journeys for desktop/mobile, light/dark themes, return from hosted capture, reload/resume, accessible errors and cross-session status refresh.
- Rerun Task 2 authentication tests and builds. Record provider sandbox evidence separately from automated fixtures.
- Prove staging still rejects financial access after sandbox approval, and that missing/invalid provider configuration never approves a case or bank. Keep schema/API fixtures confined to isolated test databases; no customer-facing approval switches.

Operational case records and audit history are prepared now for the later admin workspace. Vault remains Task 9, second to last; the admin portal remains Task 10, last.

## Proposed code structure

```text
apps/api/
  migrations/004_identity_and_banks.sql
  src/kyc/                 Case lifecycle, customer APIs and verified decisions
  src/banks/               Bank destinations and ownership checks
  src/eligibility/         Shared action-specific permission checks
  src/providers/           Selected KYC/bank integrations and webhook contracts
  src/jobs/                Durable event processing and reconciliation
  src/worker.ts            Optional dedicated worker; inline API processing is available
  test/                    Database and provider-contract tests
apps/customer/
  app/identity/page.jsx
  app/banks/page.jsx
  components/identity/     Verification flow and status screens
  components/banks/        Bank list, forms and result screens
  components/AccountShell.jsx  Extend the existing navigation/layout
  lib/                     Shared account/API access used by feature screens
tests/customer-verification/
docs/                      Provider setup, decisions and validation evidence
```

File names are proposed and may be refined after provider selection. Keep identity and bank features in their own components rather than extending every flow inside `AccountApp.jsx`.

## Proposed customer journey and API surface

The customer completes email verification, opens **Verify identity**, reviews the required evidence, completes provider-hosted ID/selfie capture, and returns to a persisted status page. A correction request opens only the permitted resubmission steps. Once identity is approved, **Bank accounts** supports adding a destination and checking its verified owner against that identity. Sandbox approval is labelled appropriately and never opens staging financial access.

Proposed routes, subject to the selected provider contracts:

| Operation            | Customer/API route                            | Responsibility                                            |
| -------------------- | --------------------------------------------- | --------------------------------------------------------- |
| Identity screens     | `/identity`                                   | Start/resume, status and corrections                      |
| Bank screens         | `/banks`                                      | Destination list and add/verify flow                      |
| Read identity case   | `GET /api/identity`                           | Current customer case and permitted next actions          |
| Start/resume capture | `POST /api/identity/sessions`                 | Stable operation identity and provider session            |
| Correct/resubmit     | `POST /api/identity/resubmissions`            | Allowed corrections with prior history preserved          |
| Read banks           | `GET /api/banks`                              | Owner-scoped, masked destinations                         |
| Add bank             | `POST /api/banks`                             | Validated, protected destination creation                 |
| Verify bank          | `POST /api/banks/:id/verifications`           | Trusted ownership/name evidence and retry/status handling |
| Check eligibility    | Existing `/api/account/financial-eligibility` | Shared current-state checks for later financial features  |
| Provider events      | `/api/webhooks/:provider`                     | Independently authenticated, durable event intake         |

Bank retirement/change endpoints depend on the agreed policy. ID document numbers, full bank details and provider capture secrets must not appear in these route paths. Any automated fixture or sandbox mode remains isolated from production verification.

The dynamic webhook notation is a planning shorthand: only explicitly configured, independently authenticated provider routes may be enabled.

## Reviewable milestones

1. **Provider decision:** country capability matrix, selected integration contracts and outstanding policy decisions recorded.
2. **Verification foundation:** migrations, protected records, authenticated APIs and durable event processing demonstrated.
3. **Identity journey:** real provider sandbox capture, status, approval and correction/resubmission demonstrated on desktop and mobile.
4. **Bank journey:** provider-backed ownership verification, mismatch handling, protected changes and masked account presentation demonstrated.
5. **Task 3 handoff:** direct API enforcement, repeated/out-of-order event handling, restart recovery and Task 2 regression checks pass, with remaining launch prerequisites listed.

## Render/Vercel rollout

1. Select provider sandbox accounts, callback URLs, country capabilities and data-handling rules. Record remaining commercial/production decisions without inventing defaults.
2. Use the implemented inline API verification pump for initial rollout. A later dedicated BullMQ worker can use Redis; it is optional rather than a new paid service requirement for sandbox validation. PostgreSQL owns durable work, leases and evidence in either arrangement.
3. Apply the next additive migration (`004`, after the existing email-only migration `003`) and deploy the API/worker with supported sandbox adapters enabled. Preserve existing data and encryption keys.
4. Redeploy the Vercel customer app with its existing Render `API_INTERNAL_ORIGIN`; verify hosted return URLs and provider webhook routing. Keys and provider session secrets stay server-side.
5. Exercise the identity and bank journeys using supported sandbox fixtures and real provider status/signature contracts. Document observed results per market; unsupported capabilities remain unavailable and cannot be counted complete.
6. Keep production activation separate: final operator details, policies, provider eligibility and full-product release gates still apply. This rollout does not change `DEPLOYMENT_STAGE` to production or approve the pending policies.

## Decisions still needed

| Decision                                                       | When it blocks work                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Smile ID account, country/document coverage and sandbox access | Provider-specific capture, signature handling and verified outcomes            |
| Bank-verification provider and ownership/name-match policy     | Account schema, trusted match results and exception handling                   |
| Redis/worker service arrangement                               | Hosted durable background processing and restart evidence                      |
| Retention, deletion and consent/disclosure rules               | Collection/storage of the affected identity evidence and production activation |
| Legal operator/contact details and final launch policies       | Real-customer launch; may remain pending during isolated sandbox development   |

Budget and provider prices remain TBD; the owner requested delivery within five days on 9 November 2026. Provider-neutral schema, authorization and unavailable-state screens can progress while these choices are resolved, but they do not constitute a working verification integration.

## Previewing the customer app in VS Code

The marketing site and customer app share one repository but run as separate Next.js apps. From the repository root:

| Purpose            | Command             | Local address                      |
| ------------------ | ------------------- | ---------------------------------- |
| Marketing          | `pnpm dev`          | `http://127.0.0.1:4173`            |
| Customer app       | `pnpm dev:customer` | `http://127.0.0.1:4200/login`      |
| Authentication API | `pnpm dev:api`      | `http://127.0.0.1:4100/api/health` |

Run the customer and API commands in separate terminals. Local PostgreSQL, migrations and `apps/api/.env` must be configured for authentication to work; follow the [Task 2 local setup](task-2-authentication.md#local-setup). Keep existing encryption keys stable when restarting an existing database.

The marketing account buttons default to the hosted customer app at `https://zetmond.vercel.app`. To preview the local registration/login pages, set `NEXT_PUBLIC_CUSTOMER_APP_ORIGIN=http://127.0.0.1:4200` in `marketing/.env.local`. For VS Code Remote/Codespaces, forward the customer port 4200 and the marketing port 4173 when previewing both. If the browser uses a forwarded HTTPS customer address, configure the API's `APP_ORIGIN` and marketing's `NEXT_PUBLIC_CUSTOMER_APP_ORIGIN` to that exact customer origin. Restart the API and marketing dev server; rebuild marketing when using a production build. The browser calls the customer app's `/api` proxy, so the API need not be exposed as a separate public port.

## Completion boundary

Task 3 is complete when selected providers produce verifiable outcomes for the enabled markets, correction/status recovery works, verified destinations are protected, and backend eligibility checks pass direct-access tests. Generic adapters or simulated approvals are insufficient completion evidence. Production availability still depends on the outstanding provider, privacy and operational approvals described in the PRD; budget remains TBD and the owner's five-day delivery request does not waive acceptance checks.
