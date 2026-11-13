# Task 4 — Accounting and custody handoff

**Accounting foundation implemented; Task 4 remains open for real custody acceptance.** No live asset, customer funds, deposit address, custody credential or private key is created. The API still returns disabled financial capabilities. Staging financial denial remains active.

Nigeria/NGN is the active market. Ghana and Kenya remain deferred; South Africa is removed. The no-BVN decision remains in force. Task 3 still needs actual Smile ID acceptance and an approved bank-ownership method without BVN. Customer wallet screens follow in Task 5, Vault in Task 9, and the admin portal in Task 10.

## Delivered

| Area           | Implementation                                                                                                                                                                                                                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact amounts  | `src/money/amount.ts`: canonical decimal strings and `bigint`, 78-digit bounds, USDT six-place/NGN two-place/rate eight-place calculations, explicit half-up quantization. No JavaScript floating-point money.                                                                                                                                        |
| Ledger         | `009_ledger_foundation.sql`, `src/ledger/ledger.service.ts`: asset/mode isolation, zero-balance account creation, balanced journals, immutable economic history, linked compensating reversals, deterministic balance locking and journal-backed projections.                                                                                         |
| Holds          | Available, trade-held, collateral-held and withdrawal-held compartments. Partial reserve/release/consume actions use stable identities and locked remaining units. Raw posting cannot bypass held compartments. Unknown external outcomes cannot release their reservation.                                                                           |
| Operations     | `010_financial_operations_and_custody.sql`, `src/financial-operations/operations.service.ts`: exact-operation MFA, current identity ID/revision, fee-inclusive reservation and encrypted intent committed together; durable leases, fencing, encrypted signed payloads and protected canonical evidence.                                              |
| Recovery       | Persist signed transaction identity before broadcast; persist unknown state before sending. Canonical lookup precedes recovery. Reuse identical saved bytes only when the adapter proves that rebroadcast is safe. `not_found` is never proof of failure.                                                                                             |
| Events         | Authenticated inbox with mode/provider/event identity, duplicate handling and separate immutable conflicting evidence. Notifications alone never credit a balance. Journal outbox delivery is at least once; consumers deduplicate journal ID. PostgreSQL polling needs no Redis wakeup.                                                              |
| Reconciliation | Compare projections with journals and actual adapter positions. Missing/mismatched custody observations or journal drift pause new reservations/transfers in that mode. Repairs rebuild only projections. Explicit operator resumption requires a fresh complete reconciliation and unchanged account versions. Existing obligations remain recorded. |
| Boundaries     | No public arbitrary posting, signing, funding or worker endpoint. Session-scoped reads return only the customer's accounts/status. Internal balances include `spending_paused`. Fixtures exist only in tests and cannot load under production configuration.                                                                                          |
| Operator tools | `src/check-ledger.ts`, `src/financial-worker.ts`, explicit runtime/operator SQL grant scripts. Readiness reports counts and disabled capabilities, without balances, addresses, keys or customer evidence.                                                                                                                                            |

The fee example tested reserves 610,000 test atomic units, settles 600,000 against custody and retains 10,000 as a fee liability. This is an engine fixture, **not an approved customer fee or revenue policy**. TRX network resources, customer USDT charges, conversion and earning conditions still need their real policies and accounting mappings.

## Recommended custody setup

Evaluate **Dfns** first for Zetmond-managed TRON wallets. Keep the customer API separate from a restricted custody service. That service must independently verify the operation, approved contract/network, destination, units, expiry, policy and fee/resource limits. Restrict its service identity and signing permissions; browser/API processes must never receive custody keys or broad signing credentials. Start with TRON Nile and an explicitly named test token.

The recommendation has limited, concrete evidence: the published [`@dfns/sdk` 0.8.35 package](https://www.npmjs.com/package/@dfns/sdk/v/0.8.35) declares `Tron`, `TronNile`, `Trc20` transfers and wallet/signature/transaction operations. The TRC-20 request includes an `externalId` described as an idempotency reference. Source inspected: `generated/wallets/types.d.ts` and `generated/wallets/client.d.ts`. The package tarball was checked against its registry SHA-512 integrity before static inspection; no vendor code was executed or installed in this repository.

This establishes SDK surface coverage, not pricing, commercial eligibility, custody guarantees or a working integration. Confirm those with Dfns before purchasing a plan. In particular, its `broadcastTransaction` SDK method accepts a **sign-and-broadcast** request: do not map that method to our separate prepare/broadcast contract without proving the required persistence and recovery semantics. Confirm protected signing, stable request lookup, canonical receipt/finality evidence, safe retries and key recovery in the sandbox first. Avoid an unrestricted raw-hash signing permission.

An alternative is an isolated signer backed by **AWS KMS**, with separate TRON RPC/indexing. The [official AWS KMS SDK enums](https://github.com/aws/aws-sdk-js-v3/blob/main/clients/client-kms/src/models/enums.ts) declare `ECC_SECG_P256K1` and `ECDSA_SHA_256`. These primitives still require a reviewed TRON codec, policy enforcement, signature handling, transaction persistence, network access, resource management and recovery. KMS alone is not a wallet integration. Pricing and account access were not verified for either option.

`CustodyPort` deliberately defaults to `UnavailableCustody`; the worker exits cleanly with a fixed unavailable message. No vendor is automatically selected by an environment flag. A real adapter must decode/verify actual signed bytes and transaction identity, authenticate canonical results and events, and provide backed positions. The synthetic fixture codec is test-only evidence about accounting/recovery behavior.

Still required for custody completion:

1. Provider account/sandbox access, service authentication, independently enforced signing policy, approved asset/network/contract and limits.
2. Real recoverable address allocation and receipt tracking by network, contract, transaction and transfer-log index, including unmatched/late/unsupported receipts. No deposit recognition path is enabled yet.
3. Approved confirmation/finality/reorg policy, network-resource estimates and actual TRX/USDT fee mappings. No confirmation count or zero-cost default is invented.
4. Actual test-network signing, canonical reconciliation, provider outage/unknown-outcome recovery, key backup/rotation and hosted database-role evidence.

## Database and deployment

Migrations `009` and `010` are additive and seed no assets, accounts or money. Preserve previous migrations. The existing migration runner serializes migrations in one transaction.

Use three separately provisioned logins before activating financial work:

| Login                         | Access                                                                                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration owner               | DDL and migration history; run only in a separate migration/release job. Never give its URL to the API or workers.                                                                                                          |
| Application/financial runtime | Existing authentication/verification permissions plus the explicit functions in `apps/api/scripts/grant-finance-runtime.sql`. No finance table writes, schema creation, private posting-function grant or owner membership. |
| Finance operator              | Readiness, reconciliation, projection repair and explicit resumption from `apps/api/scripts/grant-finance-operator.sql`. Keep out of customer/API processes. No raw posting or signing grant.                               |

The grant scripts accept psql identifier variables and do not create users/passwords or grant existing public-schema application permissions. Run them in the migration-owner context, substituting role **names**, not connection strings:

```sh
psql -v ON_ERROR_STOP=1 -v runtime_role=YOUR_RUNTIME_ROLE -f apps/api/scripts/grant-finance-runtime.sql
psql -v ON_ERROR_STOP=1 -v operator_role=YOUR_OPERATOR_ROLE -f apps/api/scripts/grant-finance-operator.sql
```

Configure the connection through the job's protected settings. Do not paste a database URL into a PR, log or shell history. The functions reject migration-owner/superuser contexts and runtime roles with direct finance-table writes. This is validated locally; the hosted Neon roles have not been changed or verified.

From the repository root, with the appropriate `DATABASE_URL` already supplied to the process:

```sh
corepack pnpm --filter @zetmond/api build
node apps/api/dist/migrate.js
corepack pnpm --filter @zetmond/api ledger:check
corepack pnpm --filter @zetmond/api worker:financial
```

Run the migration command with the migration login; run diagnostics/workers in their separate contexts. Once using a restricted runtime, split Render's existing combined `migrate.js && main.js` command into a migration job and `node apps/api/dist/main.js` runtime start. Do not replace the hosted runtime credential until the separate grants and migration path are ready. The private `.env` was not read or edited for this implementation.

`ledger:check` is read-only and requires the process environment explicitly; it does not auto-load `.env`. An unsafe/missing role returns `runtimeRoleProtected:false` and a nonzero exit, without printing a connection error. A passing role check does not enable custody or customer financial capabilities. Reconciliation/repair evidence remains in private finance tables. Investigate and record every discrepancy; never insert a balancing journal to conceal one.

## Restore procedure and evidence

Stop outbound work before restoring. Preserve protected transaction references, encryption-key access and authenticated external evidence. Restore into an isolated database and start recovery with `new FinancialOperations(auth, adapter, { recoveryOnly: true })`. This internal setting rejects new intents, signing and broadcast while permitting canonical lookup, existing-obligation settlement and duplicate event intake. It is not a customer request parameter or a deployed provider configuration flag.

Reconcile outstanding operations against the external source before enabling outbound work. A database restore cannot reverse an already-completed chain transfer. Missing results remain held; contradictory results require review. Rebuild damaged projections only from immutable entries, obtain fresh complete position evidence, and explicitly resume paused assets with the operator-only `finance.resume_asset(asset_id, reconciliation_id)` boundary. Review-state operations are intentionally not auto-closed or auto-refunded.

Validation in disposable local PostgreSQL 17/Redis 7 services:

- **214 API tests passed**, including 30 new exact-money, ledger, role, hold, custody-policy and recovery cases. Both explicit grant scripts were exercised with separate non-owner logins; direct writes, owner execution and overprivileged roles were rejected.
- API TypeScript build and customer Next.js production build passed. UI routes were not changed; browser tests remain in existing CI.
- A real `pg_dump`/`pg_restore` drill restored an older fixture backup containing an unknown transfer after its controlled external result had completed. Recovery produced the expected three journals and one inbox event, with **zero new signatures and zero broadcasts**. Replaying the event twice remained duplicate-only.
- Exact fixture settlement was 390,000 available, zero held, 400,000 custody and 10,000 fee liability from 1,000,000 initially backed units. No synthetic customer balances are seeded by deployment.

The restore drill used controlled external evidence and a test-only signature codec. It is not proof of real TRON signing, finality, provider availability, hosted recovery time or production readiness. Those remain custody acceptance gates above.
