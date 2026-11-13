# Task 4 — Ledger and custody foundation

**Status: accounting foundation implemented; real custody integration pending.** See the [implementation and operator handoff](task-4-accounting-and-custody-handoff.md) for delivered code, validation and remaining gates. Customer money features remain disabled. Original planning baseline: merged `main` at `8e7b48a`, plus the owner's no-BVN policy recorded in `f3ea263`.

Task 4 follows [PRD v1.1](../Zetmond_Production_Web_App_PRD_Mobile_Desktop_v1.1.md), Task 4 in Section 21.1, Sections 8, 16.3–16.5, 17.3, 18.3 and 19.1/19.5, and decisions O02–O04, O15–O18 and O20. It establishes exact accounting, fund reservations, durable financial operations and protected Zetmond-managed custody. Customer wallet screens follow in **Task 5**, Vault in **Task 9**, and the admin portal in **Task 10**.

## Original starting point and boundaries

Before Task 4, the repository supplied PostgreSQL migrations, authentication, role/session checks, exact-operation MFA, encrypted sensitive records, audit events, provider verification, recoverable database jobs and optional Redis/BullMQ wakeups. Migrations ended at `008`; no ledger or signer existed. The implementation now adds `009` and `010`, internal accounting/operation services and a custody contract with an unavailable default. A real signer is still outstanding.

Nigeria/NGN is the current market; the customer crypto asset is USDT on TRON/TRC-20. Ghana and Kenya stay deferred. Zetmond remains custodial. Seller-to-Vault funding will be an internal ledger movement; external deposits and withdrawals will use the custody integration.

Task 3 remains unfinished: real Smile ID sandbox acceptance and a supported bank-ownership method without BVN are outstanding. Paystack's owner-confirmed catalogue result is 287 usable entries with five conflicting codes excluded. Its bank list/name lookup cannot approve ownership. Task 4 introduces no BVN collection or replacement KYC process.

Accounting, schema, holds, job recovery and custody interfaces can be developed and tested independently now. Existing staging financial denial remains active. Any later customer money action must recheck current contact/KYC/restriction eligibility; verified bank ownership applies to the actions requiring a bank destination, rather than every crypto-wallet action. Existing obligations remain recorded when eligibility changes.

## Delivery sequence

| Work                           | Deliverable                                                                                                | Evidence before handoff                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 4.1 Exact money                | Asset registry, string-to-atomic-unit parsing, deterministic rounding and amount validation                | Precision, boundary, overflow and round-trip tests                                              |
| 4.2 Ledger                     | Protected double-entry journals, account classifications, atomic posting and rebuildable balances          | Balanced postings, immutable history, role restrictions and concurrent spend tests              |
| 4.3 Holds                      | Available, trade-held and advertiser-collateral compartments; reserve, release and consume operations      | No double reservation, no double release/capture, correct remaining liability                   |
| 4.4 Durable operations         | Stable request identity, payload binding, financial inbox/outbox, worker leases and recovery               | Crash, duplicate/conflicting event, unknown-outcome and queue-loss tests                        |
| 4.5 Custody                    | Reviewed adapter contract, isolated signing boundary and actual supported sandbox/test-network integration | Authentic asset/network checks, authorized signing, same-operation recovery and mode separation |
| 4.6 Reconciliation and handoff | Ledger/custody comparison, discrepancy records, restore/replay drill and Task 5 interfaces                 | Explainable differences, no automatic money creation, validated recovery evidence               |

These are reviewable implementation batches. They are not calendar estimates or claims that a paid custody service, signing architecture or final launch policy has been selected.

## 4.1 — Exact amounts and asset identity

- Use `BigInt` and exact integer/rational arithmetic in the API. Monetary JSON values are strings; amounts never pass through JavaScript floating-point arithmetic.
- USDT has six decimal places; NGN uses kobo/two decimal places; accepted rates have up to eight decimal places under O16. Validate asset identity/decimals against the selected integration before activation. Operational network-fee assets have separate records and accounting; they do not become customer-supported deposit assets automatically.
- Bind every account, amount, source event and operation to an immutable asset definition and environment/network. A ticker alone is insufficient. NGN books support future trade clearing, payouts and refund obligations; local-currency estimates remain display valuations.
- Reject excess input precision, malformed/exponent notation, nonfinite values, invalid signs and values outside explicit technical storage bounds. A calculated value can be quantized under policy; an invalid customer input must not be silently rounded into a different request.
- Recommended storage: exact PostgreSQL `NUMERIC(78,0)` atomic units, returned as strings. The restricted posting boundary must validate canonical integer strings **before** database casts; a scaled numeric column can round fractional input. Test the SQL boundary directly, not only the TypeScript parser.
- Apply the approved **round half up** rule once to each calculated monetary component. Persist the calculation policy/version, source quantities and accepted integer components. Totals are sums of those stored components.

**Proposed calculation order for review:** calculate principal and each fee from exact unrounded inputs, quantize each component once to its asset, then add accepted integer components. Invoice/quote activation requires a reviewed version resolving calculation-order edge cases. Tax treatment is still TBD. This plan does not substitute a default tax, rate, network fee or customer limit.

Keep O04's external deposit/withdrawal policy separate from the 0.5% P2P fee per party. O04 still leaves the 1-USDT credit threshold's gross/net interpretation and small-receipt handling unresolved. General arithmetic can be implemented while those financial outcomes remain unavailable for activation.

## 4.2 — Ledger and balances

Use a double-entry ledger with account roles for custody assets, customer liabilities, held funds, clearing/unmatched receipts, outstanding payouts/refunds and platform fees. Review the chart of accounts and fee-recognition mapping before financial activation.

Each posted journal must have at least two valid legs and balance exactly within a single asset/environment. Cross-currency exchange uses separately balanced, linked journals; it cannot offset a USDT imbalance with NGN. The business operation and all applicable internal journals, state transitions, audit references and outbox entries commit in one PostgreSQL transaction.

Recommended proposed records:

| Record                                            | Purpose                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ledger_assets`                                   | Immutable unit precision, network/environment and contract/reference identity            |
| `ledger_accounts`                                 | Asset, owner/system role, normal balance side and available/held/clearing compartment    |
| `ledger_journals` / `ledger_entries`              | Immutable business reference, posting legs, source evidence and correction links         |
| `ledger_account_balances`                         | Transactional projection with account version; reconstructible from journals             |
| `ledger_holds`                                    | Durable purpose, remaining reservation, authorized operation and posting links           |
| `financial_operations` / `financial_attempts`     | Immutable intent, payload digest, policy, external references and attempts               |
| `financial_event_inbox` / `financial_outbox`      | Authenticated source events and work committed with domain changes                       |
| `custody_intents`                                 | Protected destination/network/asset/fee snapshot, key reference and transaction identity |
| `reconciliation_runs` / `reconciliation_findings` | Compared sources, explainable differences and unresolved exceptions                      |

The application runtime role must not directly insert/update/delete journals or edit balances. Use validated posting functions and database-enforced balance/uniqueness checks, including deferred constraint checks where needed. Pin privileged function search paths and separate migration/owner privileges from runtime privileges. Actual hosted-role restrictions must be demonstrated; an owner-level application connection cannot establish this protection.

The current migration entrypoint and API both read `DATABASE_URL`; starting them sequentially does not create separate credential boundaries. Plan a separately authorized migration context and keep its owner credentials out of the API environment. An owner-run migration or separate deployment job can provide that boundary; paid Render Shell is not assumed. Choose and test the hosted arrangement before claiming runtime write restrictions. Use additive migrations and forward-compatible recovery without deleting posted financial history during a rollback.

Postings are append-only. Corrections use linked compensating journals with controlled reasons and authority; existing entries are never overwritten. Prepare the authorization boundary now, with operational adjustment UI delivered in Task 10.

Lock the relevant balance/account rows in a consistent order, check current available funds and update entries/projections/versions atomically. Reject negative customer available or held balances; no overdraft product is approved. System account normal-balance rules must be explicit and reviewed.

Balance projection repair must use a consistent snapshot plus account-version/locking checks. A global sequence number alone does not establish commit order. Rebuild projections without changing economic journal history; a live mismatch becomes a recorded exception and blocks affected spending until checked.

## 4.3 — Holds and balance meanings

Expose the following internal accounting meanings for Task 5's later UI:

- **Available:** recognized customer entitlement currently free to reserve.
- **Trade-held:** recognized entitlement reserved for an authorized trade obligation.
- **Advertiser-held:** collateral, separate from trade principal and available funds.
- **Pending external:** an observation/status, excluded from spendable balance until verified credit. Pending outgoing funds remain reserved while their result is uncertain.

The recognized customer total is available plus the applicable held compartments. Holds are movements between compartments, not a second copy of the same balance. Hold records describe their journal-backed reservation; summing hold rows again must not inflate that total.

Implement internal `reserve`, `release` and `consume` commands with stable operation IDs, exact amounts and locked remaining values. A reservation can be released or consumed only once for the same remaining units. Support partial actions only with explicit amounts and conserved totals.

Reserve the full authorized debit, including customer-charged fees, for a future withdrawal. Keep principal, refundable fees and collateral distinguishable under their approved posting policies; holding only the principal must not leave already-authorized fees available for another spend.

Hold expiry is a review/recovery trigger when an external outcome is unknown. Do not release funds while the corresponding transfer can still succeed. Generic expiry support does not implement Vault's 20/15-minute funding timers; those remain Task 9.

**Fixture example:** start an isolated test customer with 1 USDT. Two simultaneous 0.7-USDT reservations must result in one successful reservation: 0.3 available, 0.7 held. Release restores exactly 1 available. Fixture funding remains confined to automated tests; migrations create no customer money.

## 4.4 — Operations, events and recovery

1. Persist the authorized financial intent and canonical payload digest before any external request. Bind identity to customer, action, asset, environment/network, destination, amount, material fees and policy version. Reuse the same operation ID for recovery.
2. Commit the required hold, exact-operation MFA consumption, intent and outbox entry together when the business action requires customer authorization. An identical retry returns the saved operation; changed details or a different owner fail. Later recovery reuses the saved authority rather than consuming another MFA grant for the same committed intent.
3. Dispatch after commit. PostgreSQL is the durable source of work. Reuse the existing lease/fencing and optional BullMQ wakeup pattern in a separate financial-job namespace; Redis loss must not erase or duplicate a financial obligation.
4. Record attempts and transitions such as prepared, signed, submitted, confirming, complete, proven failed, unknown and under review. Provider timeout means unknown; canonical lookup/reconciliation precedes another potentially chargeable or irreversible submission.
5. Authenticate raw provider events and persist them before acknowledging durable receipt. Reject forged sources; deduplicate valid events by their actual source identity. Conflicting payloads for one event reference enter review instead of replacing earlier evidence.
6. For TRC-20 receipts, scope identity to environment, network, contract, transaction and transfer-log index. A transaction may contain multiple transfers. Store source/block references and verified receipt time separately from notification arrival; arrival time is not a provider decision revision.
7. Record unmatched, late and unsupported receipts for reconciliation. Recognized but unattributed funds retain an appropriate liability; they do not become platform revenue. Fees refundable on cancellation remain liabilities/held amounts until the approved earning condition occurs.

Rechecking eligibility prevents new unauthorized actions while retaining already-existing financial records and outstanding obligations. Status/recovery must not create another payment or silently discard a liability when a customer is restricted.

## 4.5 — Custody and protected signing

Define the provider boundary before choosing an implementation:

| Capability            | Required contract                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| Address allocation    | Stable request reference, ownership/key reference, real recoverable address and configured network |
| Receipt/status lookup | Canonical transaction/log evidence, correct asset, status/finality and safe recovery               |
| Transfer preparation  | Exact destination, asset/network, units, fee constraints and immutable intent digest               |
| Signing authorization | Narrow typed transaction policy, authorized service identity, key reference and approved limits    |
| Submission/recovery   | Persisted signed transaction/provider reference, same-operation lookup and duplicate prevention    |
| Position visibility   | Actual custody balances/positions and evidence sufficient for reconciliation                       |

Use an isolated signer or a reviewed custody arrangement that preserves Zetmond's custodial control. The web API/browser must not receive private keys. The profile/KYC `DATA_ENCRYPTION_KEY` is not a custody key-management design. No private-key field or arbitrary raw-signing endpoint is added to the customer API.

The signer must independently check the authorized intent, configured network/contract, supported transfer method, destination, units, fee/resource budget and policy version. A service request must not authorize signing arbitrary bytes. Persist the signing request and transaction identity before broadcast; keep protected signed payload/evidence out of broad logs.

Treat signing and broadcasting as distinct stages. Recovery can rebroadcast the same permitted transaction only under the selected contract. Expiry or a lost response does not authorize constructing a second transfer while the first outcome remains unresolved.

Validate TRON address format/checksum and bind network separately: an address prefix alone cannot distinguish test and production networks. Pin the supported token identity and actual network endpoints from authoritative integration evidence. Clearly identify sandbox/test assets rather than calling an arbitrary test token production USDT.

Network resource costs and customer USDT charges are separate accounting components, potentially in different assets. Provider-backed fee quotes, conversion rules and resource management must be defined before activation; an unavailable estimate is not a zero-cost transfer.

An unconfigured/unsupported custody adapter returns unavailable. Synthetic fixture adapters are test-code-only and cannot be enabled by an HTTP request or production environment flag. Actual sandbox adapters use the selected provider's real test integration and mode-specific credentials. Protected signing and recovery evidence are required before this custody milestone is complete.

## 4.6 — Reconciliation and operational handoff

Compare journal-derived entitlements and clearing liabilities with authenticated custody/provider positions. Record matched observations, pending finality, in-flight transfers, fee differences, unmatched receipts and unexplained discrepancies separately. A balanced ledger alone does not establish backing by external assets.

Create protected discrepancy records and a narrow read-only owner diagnostic reporting invariant/queue/reconciliation status without keys, full addresses, customer amounts or identity/bank evidence in logs. Prepare record formats and service permissions for Task 8 operations and Task 10 administration.

Never auto-credit a customer, erase a liability or post a balancing adjustment merely to make reconciliation pass. Reorgs, later external reversals and contradictory final results preserve original records and open an exception under the approved recovery policy.

Exercise database backup/restore and event replay against controlled test sources. After restore, outbound work stays paused until external results have been reconciled; completed chain transfers do not roll back with PostgreSQL. Record recovery evidence and unresolved exceptions, rather than claiming a recovery time or availability promise without measurement.

## Service boundaries and proposed structure

Task 4 exposes typed **internal** posting, balance-read, hold, operation-status and custody interfaces. The browser cannot supply arbitrary journal legs, account owners or balance changes. Owner-scoped reads must not disclose other customers' legs from a shared journal. Task 5 will build the public wallet contracts and responsive screens over these services; existing unavailable states remain truthful in the meantime.

```text
apps/api/
  migrations/
    009_ledger_foundation.sql
    010_financial_operations_and_custody.sql
  src/
    money/{amount,assets,rounding}.ts
    ledger/{accounts,posting,balances,holds,reconciliation}.ts
    financial-operations/{intent,operations,inbox,outbox-worker}.ts
    custody/{custody.port,signing-policy,readiness}.ts
    jobs/financial-queue.ts
    financial-worker.ts
    check-ledger.ts
  test/
    money.test.ts
    ledger.test.ts
    ledger-concurrency.test.ts
    ledger-holds.test.ts
    financial-recovery.test.ts
    custody-contract.test.ts
    reconciliation.test.ts
docs/
  task-4-ledger-custody-plan.md
  task-4-accounting-and-custody-handoff.md
```

This is the original proposed layout. The handoff lists the implemented files; related responsibilities are grouped into smaller service modules. Existing migration history, authentication/verification flows and the user's private `.env` are preserved. No paid service, custody key or production configuration is created.

## Validation matrix

| Scenario                                                              | Expected result                                                                              |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Decimal input and half-up ties                                        | Exact string/atomic-unit results; excess precision and fractional SQL atomic inputs rejected |
| Unbalanced, mixed-asset or cross-environment journal                  | Whole transaction rejected, with no partial balance/state/outbox change                      |
| Direct journal/balance write using runtime role                       | Denied; permitted posting boundary enforces the same invariants                              |
| Same operation repeated / changed payload / other customer            | One economic result; conflict or denial for changed scope                                    |
| Two withdrawals, holds or collateral reservations compete             | Locked available funds permit only the affordable aggregate                                  |
| Concurrent release versus consume / partial recovery                  | Reserved units conserved; no double release or spend                                         |
| Pending deposit or forged/wrong-contract receipt                      | No spendable credit; valid unmatched observations remain recoverable                         |
| Duplicate/out-of-order event and multiple logs in one transaction     | One effect per genuine transfer; distinct transfers retained                                 |
| Crash before commit, after commit or after provider acceptance        | Atomic rollback or same-operation recovery; no blind second transfer                         |
| Redis wakeup lost or worker lease expires                             | Database work recovers; stale workers cannot apply duplicate effects                         |
| Signer unavailable, tampered intent or wrong mode/network/key context | Unavailable or rejected; no substitute signature or fabricated transaction                   |
| Projection drift, external discrepancy, restore/replay or reversal    | Detect and preserve evidence; affected outbound work waits for reconciliation                |
| Staging, restricted/KYC-incomplete user or another user's record      | Existing financial/ownership boundaries hold; no test approval shortcut                      |

Use dedicated local databases ending in `_test`; provider fixtures are separate from real integration evidence. Run the financial unit/PostgreSQL/concurrency suite and relevant API/build/authentication regressions. Run browser tests when later wiring changes the customer UI. Test actual selected sandbox/test-network signing and recovery before claiming custody acceptance.

## Decisions and completion gates

| Decision/evidence still needed                                                           | Effect on work                                                                                  |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Approved chart of accounts, fee recognition and calculation-order details                | Generic engine/tests proceed; affected financial posting policies stay inactive until reviewed  |
| Custody backend, key authority, secure storage and service authentication                | Interfaces and unavailable behavior proceed; real signing integration needs this choice         |
| Address allocation model, finality/reorg policy and authoritative network/token identity | Required for recognized deposits and completed transfers; no invented confirmation threshold    |
| Network resources, fee quotation/conversion and withdrawal risk limits                   | Required before authorized external transfer activation                                         |
| Protected key backup/rotation/recovery and actual hosted database-role separation        | Required custody/recovery/security evidence; new services or account plans are not assumed      |
| Task 3 identity acceptance and ownership without BVN                                     | Independent foundations proceed; affected customer eligibility/bank capabilities remain blocked |
| Outstanding O04 threshold/small receipts, tax and exception decisions                    | Preserve observed money/liabilities; do not silently choose an economic outcome                 |

**Accounting milestone ready:** exact amounts, protected balanced postings, trustworthy balance projections, holds and durable operations pass their invariants and recovery tests on empty migrations and realistic fixtures. This milestone can be reviewed while provider decisions remain open.

**Task 4 complete:** the accounting milestone plus the actual reviewed custody/signing integration, sandbox/test-network authorization and unknown-outcome recovery, reconciliation and restore evidence are demonstrated, with the applicable accounting/security decisions recorded. Interfaces or fixture signatures alone cannot satisfy the custody requirement.

Handoff to Task 5 includes the asset/account mapping, amount/rounding contracts, internal service interfaces, protected custody references, failure/recovery states and test evidence. Public real-money activation still follows the full PRD release gates and later operational/admin work. Task 3 remains separately open until its provider-backed evidence is complete. Vault stays second to last and the admin portal last.
