# Task 3 — KYC and bank verification plan

Status: proposed implementation plan. Task 3 application work has not started.

This plan follows PRD v1.1 Sections 4, 7.4–7.5, 13.3, 17.4 and 21.1, and decisions O01, O19, O20, O22 and O25. Provider selection and policies marked TBD in that PRD remain undecided.

## Goal and existing foundation

Customers can complete identity verification, see verified outcomes and correction requests, and add bank destinations whose ownership is verified. The backend enforces eligibility and ownership on every relevant request.

Task 2 already supplies registration, shared customer/admin login, email and phone verification, MFA, session management, PostgreSQL migrations, audit events, encrypted delivery records and a basic financial-eligibility check. The saved baseline is `d613f62`, including working marketing-to-customer account links and the API runtime dependency fix. Task 3 extends these services and the current Zetmond logo, purple styling, light/dark themes and responsive account layout. Live email/SMS delivery and production configuration still have the prerequisites documented under Task 2.

When implementation begins, use `feat/task-3-kyc-bank-verification` based on that Task 2 work (or the merge commit containing it). The current document is a planning draft, not an implementation or provider approval.

Launch markets remain Nigeria/NGN, Ghana/GHS, South Africa/ZAR and Kenya/KES. Customers must be at least 18 and complete government-ID plus selfie/liveness verification. Both contact channels must be verified before financial access.

## Delivery sequence

### 3.1 — Choose providers and resolve integration rules

Research KYC and bank-verification providers against a country-by-country capability matrix. Confirm supported documents, liveness, age verification, bank identifiers, account-name/ownership evidence, authenticated results, status lookup, retries, pricing, data handling and eligibility to serve Zetmond's disclosed business.

Prefer provider-hosted identity capture to minimize locally held documents. A bank lookup or a typed account-holder name alone must not establish ownership.

Before the affected integration is activated, resolve:

- Selected provider(s), sandbox credentials, webhook configuration and eligible country coverage.
- Accepted documents, required customer fields and consent/disclosure wording per country.
- Bank-name matching rules, joint/business-account treatment and mismatch resolution.
- Correction, rejection, reverification and restriction handling, including a permitted support/appeal path.
- Retention/deletion responsibilities and bank retirement/removal policy.

Provider adapters, schema and screens can progress before credentials are available. Completion requires actual provider-backed verification evidence; unsupported countries or missing integrations must remain clearly unavailable.

### 3.2 — Durable verification records

Add additive PostgreSQL migrations for identity profiles, KYC cases/attempts and decision history, bank destinations and verification attempts, and a provider-event inbox. Keep sensitive identity/bank fields encrypted and retain minimal provider references where possible.

Extend the current four-value KYC status model to represent the full workflow. Keep provider availability and account restrictions distinct from the case's verification outcome. Preserve prior decisions and link resubmissions to their original case.

Use explicit state transitions, operation identifiers, ownership constraints and audit records. Bank records must support immutable destination versions so later trade snapshots cannot be redirected by a profile edit.

### 3.3 — KYC backend integration

Implement authenticated APIs to read status, start/resume verification and request permitted corrections. Validate country and age using trusted provider evidence. Bind each provider session and result to the correct customer and attempt.

Support not-started, incomplete, submitting, under-review, approved, correction-required and rejected outcomes, with separate unavailable/restricted explanations. A browser return from provider capture is not approval: the backend verifies the result.

Provider webhooks need their own source authentication and signature/raw-body handling; they cannot use the current browser-only Origin/custom-header check. Persist authenticated events durably, deduplicate deliveries and reconcile canonical provider status before applying conflicting or out-of-order results. Add recoverable background processing using the approved Redis/BullMQ stack with PostgreSQL as the durable source of work and results.

### 3.4 — Bank destination verification

Implement country-specific bank lists/identifiers and an authenticated add/verify/list flow. Compare provider-confirmed ownership against the verified identity using the selected matching policy. Show pending, verified, mismatch, unavailable and inactive states with masked account details.

Extend Task 2's operation-bound MFA grants for sensitive destination changes. Consume authorization for the exact change in the same database transaction. Protect every bank record by customer ownership, and preserve verification history when a destination is retired under the agreed policy.

### 3.5 — Customer screens

- Identity overview: requirements, current state and start/resume action.
- Verification flow: provider-hosted capture, return/status recovery and permitted corrections.
- Outcome screens: approval, actionable correction, rejection/restriction and provider outage.
- Banks: list, add, verification result and protected destination-management actions.
- Account overview: replace the identity-verification placeholder with real progress and next actions.

Use a step panel with guidance on desktop and one clear step per screen on mobile. Provide the provider-supported camera/file alternatives. Recover status after reload, login or browser suspension without creating duplicate submissions. Never store identity evidence or full bank details in browser storage or analytics.

### 3.6 — Eligibility enforcement

Create reusable backend eligibility checks using current account, contact, KYC and restriction records. Base customer eligibility requires verified email/phone, approved KYC and no disqualifying restriction. Verified bank ownership is an additional requirement for relevant payout/advertiser operations; it is not automatically a prerequisite for every wallet action. MFA requirements remain specific to sensitive actions.

Refresh displayed status in open sessions and recheck permission when an operation executes. A later restriction or KYC change must preserve existing records and financial obligations. Task 3 establishes these checks; financial capabilities become available only through their later implementation tasks and release gates.

### 3.7 — Verification and handoff

- PostgreSQL integration tests for ownership, valid transitions, encrypted records and restart recovery.
- Provider-contract tests for authentic results, forged/replayed events, duplicate submissions, late/conflicting results and unavailable providers.
- Age/country/document validation, correction/resubmission, bank mismatch and exact-operation MFA tests.
- Direct API tests showing that unapproved or restricted users cannot bypass eligibility, and one customer cannot access another's bank or identity case.
- Browser journeys for desktop/mobile, light/dark themes, return from hosted capture, reload/resume, accessible errors and cross-session status refresh.
- Rerun Task 2 authentication tests and builds. Record provider sandbox evidence separately from automated fixtures.

Operational case records and audit history are prepared now for the later admin workspace. Vault remains Task 9, second to last; the admin portal remains Task 10, last.

## Proposed code structure

```text
apps/api/
  migrations/003_identity_and_banks.sql
  src/kyc/                 Case lifecycle, customer APIs and verified decisions
  src/banks/               Bank destinations and ownership checks
  src/eligibility/         Shared action-specific permission checks
  src/providers/           Selected KYC/bank integrations and webhook contracts
  src/jobs/                Durable event processing and reconciliation
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

The customer completes contact verification, opens **Verify identity**, reviews the required evidence, completes provider-hosted ID/selfie capture, and returns to a persisted status page. A correction request opens only the permitted resubmission steps. Once identity is approved, **Bank accounts** supports adding a destination and checking its verified owner against that identity.

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

## Reviewable milestones

1. **Provider decision:** country capability matrix, selected integration contracts and outstanding policy decisions recorded.
2. **Verification foundation:** migrations, protected records, authenticated APIs and durable event processing demonstrated.
3. **Identity journey:** real provider sandbox capture, status, approval and correction/resubmission demonstrated on desktop and mobile.
4. **Bank journey:** provider-backed ownership verification, mismatch handling, protected changes and masked account presentation demonstrated.
5. **Task 3 handoff:** direct API enforcement, repeated/out-of-order event handling, restart recovery and Task 2 regression checks pass, with remaining launch prerequisites listed.

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

Task 3 is complete when selected providers produce verifiable outcomes for the enabled markets, correction/status recovery works, verified destinations are protected, and backend eligibility checks pass direct-access tests. Generic adapters or simulated approvals are insufficient completion evidence. Production availability still depends on the outstanding provider, privacy and operational approvals described in the PRD; no budget or delivery date is assumed.
