# Task 2 — Accounts and authentication

## Repository structure

```text
marketing/                       Existing public Next.js site (retained)
apps/
  customer/
    app/[screen]/page.jsx        Explicitly allowlisted account routes
    app/policies/page.jsx        Clearly labelled development policy notice
    components/AccountApp.jsx    Shared login and responsive account forms
    components/AccountShell.jsx Public layout and signed-in account navigation
    components/Brand.jsx        Marketing logo and Zetmond wordmark
    components/AppearanceToggle.jsx  Light, dark and system appearance
    components/FormField.jsx    Accessible fields and password visibility
    public/                     Original marketing logo
    next.config.mjs              Same-origin /api proxy to NestJS
  api/
    migrations/                 Versioned PostgreSQL account/security schema
    src/auth/                    Validation, controller and auth service
    src/delivery/                Encrypted transactional delivery outbox
    src/config.ts                Validated policy and environment settings
    src/app.ts                   NestJS application and HTTP protections
    src/provision-admin.ts       Owner-operated named admin provisioning
    src/read-local-message.ts    Development-only local message inspection
    test/auth.test.ts            Real PostgreSQL integration tests
scripts/                         Local infrastructure helpers
tests/customer-auth/            Browser account journeys (see actual tests/ path)
playwright.auth.config.js        Isolated auth browser suite
pnpm-workspace.yaml              Shared pnpm workspace
```

The customer app, public marketing site and API have independent build/start commands. The separate admin UI is deliberately deferred to Task 10; `/admin-access` only confirms protected authentication readiness. Customer and admin use `/login`, but the backend derives the role from persisted account records. No client role selector exists.

## Account appearance

Account screens use the marketing site's original logo, Inter body text, Space Grotesk headings, and purple palette. `Brand` uses the same symbol crop as the marketing header. Desktop public forms feature an enlarged version of that symbol on a dark purple gradient, with the headline “Your next move starts here.” The source logo remains in `marketing/public/`; an identical copy in `apps/customer/public/` allows the customer app to serve it independently.

The customer layout imports the existing marketing theme provider and before-paint initialization script. Light, dark and system preferences persist in the browser. Public account forms pair with artwork on larger screens; authenticated pages use a sidebar on desktop and compact navigation on mobile. The account overview shows persisted verification and security status, with unavailable identity-verification and financial features labelled clearly.

## Delivered flows

- Customer registration in NG/NGN, GH/GHS, ZA/ZAR and KE/KES, with matching international phone validation and versioned policy acceptance.
- Email and phone challenges, expiry, attempt limits, resend cooldown and persisted delivery state.
- Argon2id password hashes, opaque hashed sessions, secure HTTP-only cookies, logout and owner-scoped session revocation.
- Authenticator-app enrollment and challenge, one-time recovery codes, TOTP replay protection, session-token rotation and mandatory administrator MFA.
- Generic password-recovery responses, single-use reset links, revocation of existing sessions and queued security notices.
- Purpose/operation-bound, expiring, single-use step-up grants; password changes consume authorization for the exact new password. Future withdrawals/contact changes must consume equivalent grants inside their own atomic operation. A grant alone does not execute an operation.
- Contact/KYC eligibility and admin permission checks on the backend. New accounts have `not_started` KYC. No fake approvals, balances, funding or financial controls.
- Persisted audit events containing safe action metadata rather than passwords, codes or document contents.

## Local setup

Use Node 22+ and the repository's pnpm 11.9.0. From the repository root:

```sh
pnpm install --frozen-lockfile
# Start a LOCAL database; this helper uses a development-only credential.
bash scripts/auth-database.sh
cp apps/api/.env.example apps/api/.env
# Replace DATA_ENCRYPTION_KEY in .env with a private random 32-byte hex key:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
pnpm db:migrate
pnpm dev:api
# In a second terminal:
pnpm dev:customer
```

API: port 4100. Customer: port 4200. Existing marketing: `pnpm dev`, port 4173. No shared root Next.js route or marketing source migration is required. For build/serve use `pnpm build:auth`, `pnpm --filter @zetmond/api start`, and `pnpm --filter @zetmond/customer start` (supply environment variables or Node's `--env-file` for the compiled API).

Development delivery keeps encrypted messages in PostgreSQL rather than pretending to deliver email/SMS. An owner at the terminal can inspect their test inbox:

```sh
pnpm --filter @zetmond/api delivery:local test-user@example.com
```

This command reveals test verification secrets locally. Never share its output or use real customer data in development. There is no web inbox, hardcoded OTP, fake provider success, or verification bypass endpoint. The CLI refuses production/provider mode. Keep the encryption key stable across restarts; rotation requires an explicit re-encryption/re-enrollment plan.

## Named administrator provisioning

Provision through an access-controlled operator terminal with database access. Load configuration from `apps/api/.env` or secure process bindings, then supply `PROVISION_ADMIN_EMAIL`, `PROVISION_ADMIN_COUNTRY` and a unique `PROVISION_ADMIN_PASSWORD` through the process environment. Use a secure prompt/secret manager; do not put passwords into command history or commit files.

```sh
pnpm admin:provision
```

The command creates a new admin only; it never promotes an existing customer, resets an existing admin, or supplies default credentials. The database stores an Argon2id hash. The first shared login requires authenticator enrollment and recovery-code storage before admin permission checks pass. The production provisioning operator must be individually attributable through infrastructure access records. A full operational action/approval matrix remains Task 10.

## Provider delivery

Set `DELIVERY_MODE=provider` with the approved SMTP configuration and SMS gateway. SMTP requires TLS. The gateway adapter sends HTTPS JSON `{to,text,reference}` with a bearer token and stable `Idempotency-Key`; integrate a selected provider behind that contract. Provider selection and contract validation remain outstanding. The outbox commits with the account/challenge transaction, retries failures with backoff and preserves failed delivery status for investigation. Expired verification payloads are cleared and never delivered. Successful message payloads are cleared. Delivery success is not contact verification.

Production refuses to start with development delivery, draft terms, non-HTTPS app origin, missing provider settings, or `SECURITY_POLICY_APPROVED=false`, or missing approved HTTPS terms/privacy URLs. Never set that flag merely to silence validation. The policy values, final legal pages, provider behaviour, ingress/rate policy and deployed session isolation must be reviewed first.

## Provisional development security settings

These implement configurable behaviour for testing; they are not newly approved commercial/security policy:

| Setting                                         | Development default |
| ----------------------------------------------- | ------------------: |
| Customer absolute session                       |         720 minutes |
| Admin absolute session                          |          60 minutes |
| Verification/reset validity                     |          10 minutes |
| Verification code attempts                      |                   5 |
| Failed sign-ins before lockout                  |                   5 |
| Temporary lockout                               |          15 minutes |
| Mutation requests per route/IP and email/window |  30 per 900 seconds |
| Verification resend cooldown                    |          60 seconds |
| MFA enrollment recent-session window            |          10 minutes |
| Exact-operation step-up validity                |           5 minutes |

Passwords must have 12–128 characters. Authenticator steps are 30 seconds with no extra clock-drift window; synchronize server time. Recovery codes are single-use and are not a support bypass. Session expiry is enforced in PostgreSQL. Browsers hold no bearer tokens in local storage. Origin plus custom-header checks protect mutations; cookies are host-only, HTTP-only, SameSite Strict and Secure with a `__Host-` prefix in production. Do not enable permissive CORS. Production ingress must rate-limit per real client; the API deliberately does not trust arbitrary forwarding headers. Do not expose the database or API directly to untrusted networks.

## Tests

Tests must use a **separate PostgreSQL database whose name ends `_test`**. Both suites erase that database's auth tables. Never point them at development/customer data. Run suites sequentially or use separate databases. Browser tests read encrypted test messages directly with the test key; no debug HTTP route exists.

```sh
export TEST_DATABASE_URL=postgresql://zetmond:local-development-only@127.0.0.1:5432/zetmond_auth_test
pnpm test:auth
pnpm build:auth
# Install Playwright Chromium or select an existing supported executable:
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm test:auth:browser
pnpm build
pnpm test
```

Backend coverage includes direct role injection, invalid eligibility inputs, encrypted outbox, one-use/expired challenges, concurrent reset replay, owner-scoped sessions, mandatory admin MFA, TOTP/recovery-code replay, operation-bound password changes, hostile origins, lockout, API restart persistence and production configuration gates. Browser checks cover responsive public/account screens, contact verification, recovery, login, sessions, denied admin access and administrator MFA enrollment. They also check logo loading, light/dark/system preference persistence, password visibility and active account navigation. Marketing has its own existing suite; it does not collect auth browser tests.

## Remaining production prerequisites

- Approved email/SMS providers with real delivery and failure/retry evidence in all four countries.
- Approved country-specific legal disclosures and retention policies; current policy notice is development-only.
- Approved exact security timing/rate/recovery policy and incident/support procedures.
- Task 3 KYC/bank integration and production age/document verification; registration attestation is not KYC evidence.
- Domain, HTTPS ingress, PostgreSQL backup/recovery, least-privilege database access, encryption-key custody/rotation, security monitoring and independent security validation.
- Task 10 admin operational UI, recovery approval matrix and second-admin financial approvals.
- Contact-change, MFA replacement/removal, account closure and broader security/settings lifecycle belong to later account-service work and require the approved recovery policy. Task 2 does not expose insecure substitutes.

No real-money capability or production readiness is claimed by this task.

## Continuous integration

`.github/workflows/accounts.yml` runs the PostgreSQL integration suite, backend/customer builds, authentication browser tests, and existing marketing build/tests on pushes and pull requests. Local validation is recorded separately; a pushed workflow still needs to execute on GitHub.
