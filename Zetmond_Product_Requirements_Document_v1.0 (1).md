# Zetmond — Product Requirements Document

**Version:** 1.0  
**Prepared:** 19 October 2026  
**Status:** Product definition for review; confirmed rules plus explicitly identified open decisions  
**Current delivery:** Responsive web product experience with illustrative funds and integrations  
**Long-term product:** Custodial USDT wallet and P2P marketplace with two-sided Vault settlement  
**Audience:** Product owner, implementation collaborators, designers, testers, and future operations team

> This is a new PRD. It does not modify or replace the existing business plan. It records the latest decisions made in the Zetmond discussion. Earlier drafts and screenshot wording do not override those decisions. No deadline, budget, provider approval, advertiser threshold, or unconfirmed fee is implied.

## Contents

1. [Document rules and decision status](#1-document-rules-and-decision-status)
2. [Product definition and goals](#2-product-definition-and-goals)
3. [Confirmed decision register](#3-confirmed-decision-register)
4. [Scope and product surfaces](#4-scope-and-product-surfaces)
5. [Users, roles, and permissions](#5-users-roles-and-permissions)
6. [End-to-end journeys](#6-end-to-end-journeys)
7. [Accounts, KYC, and country settings](#7-accounts-kyc-and-country-settings)
8. [USDT wallet requirements](#8-usdt-wallet-requirements)
9. [P2P marketplace and advertiser requirements](#9-p2p-marketplace-and-advertiser-requirements)
10. [Trade agreement, invoices, and charges](#10-trade-agreement-invoices-and-charges)
11. [Vault funding, timers, settlement, and refunds](#11-vault-funding-timers-settlement-and-refunds)
12. [Complete page and flow inventory](#12-complete-page-and-flow-inventory)
13. [Design and responsive behaviour](#13-design-and-responsive-behaviour)
14. [Admin portal and operations](#14-admin-portal-and-operations)
15. [Activity, notifications, and support](#15-activity-notifications-and-support)
16. [Logical records and system boundaries](#16-logical-records-and-system-boundaries)
17. [Security, reliability, and quality requirements](#17-security-reliability-and-quality-requirements)
18. [product experience specification](#18-product experience-specification)
19. [Acceptance scenarios](#19-acceptance-scenarios)
20. [Delivery sequence and readiness gates](#20-delivery-sequence-and-readiness-gates)
21. [Measures of success](#21-measures-of-success)
22. [Open decisions and questions](#22-open-decisions-and-questions)
23. [Reference material and glossary](#23-reference-material-and-glossary)

## 1. Document rules and decision status

The product owner requested that unresolved decisions not be silently assumed. This PRD uses the following labels:

| Label | Meaning |
|---|---|
| **Confirmed** | Explicitly agreed in the product discussion. |
| **Derived requirement** | Behaviour needed to make an agreed rule work consistently, such as preventing duplicate payouts. It does not introduce a new price, market, or user privilege. |
| **Proposed** | A suggested design, operational control, or implementation detail for review. It is not an approved business decision. |
| **TBD** | A decision still requiring the product owner's answer. |

Requirement IDs identify functional areas and acceptance checks. Conceptual record names and status names are descriptive; they do not commit the project to a framework, database, schema, or API.

For a blocked decision, the product experience should show an explicit placeholder or unavailable action. A test fixture may exercise a scenario, but must be identified as illustration data rather than published policy. No new production business rule should be inferred from an arbitrary sample value.

## 2. Product definition and goals

### 2.1 What Zetmond is

Zetmond is an Africa-focused custodial crypto wallet and P2P trading product. Users hold USDT, can send and receive supported USDT transfers, and see an estimated local-currency value based on their registration country. Zetmond controls the wallet keys in the intended live product.

The Vault coordinates a trade by collecting the seller's USDT and the buyer's fiat payment, verifying them against the accepted invoice, and delivering the agreed assets to the opposite parties. Neither trader decides the final release after funding conditions are satisfied.

The USDT seller receives local currency in their bank account. The USDT buyer receives USDT in their Zetmond wallet. Both sides of the crypto movement for P2P are within Zetmond. Ordinary wallet deposits and withdrawals can involve external wallets.

### 2.2 Problem addressed

The product owner identified a P2P problem: one person sends fiat and then depends on the other person to release crypto. Zetmond's proposed solution places both deposits under the Vault's coordination so settlement does not depend on the seller's further cooperation.

This does not mean all financial risk disappears. Delayed payments, incorrect transfers, failed payouts, account disputes, and reconciliation still need explicit handling. The product must show those states accurately.

### 2.3 Product goals

- Let a verified user hold, send, and receive USDT through an account-based experience.
- Make local-currency estimates understandable without presenting them as fiat wallet balances.
- Let eligible advertisers publish fixed-rate P2P offers.
- Show each party exactly what to deposit, including their platform fee, before payment.
- Allow either party to fund first and enforce the agreed funding windows.
- Coordinate both settlement obligations and expose their individual status.
- Return funds on cancelled trades under the agreed refund policy.
- Preserve a clear transaction and administrative audit history.
- Provide a usable responsive website across desktop, tablet, and phone.

### 2.4 Current non-goals

- Native Android or iOS applications in the current build.
- A spendable fiat wallet or general-purpose fiat balance.
- Assets other than USDT.
- User-managed recovery phrases or self-custody.
- Price negotiation as part of the fixed-rate order flow.
- Real customer money, real private keys, live KYC documents, or live bank payouts in the product experience.
- Unconfirmed extras such as staking, lending, leverage, swaps, cards, referrals, or business accounts.

## 3. Confirmed decision register

| ID | Confirmed decision |
|---|---|
| D01 | Product name: **Zetmond**. Older Petmond/Zetmod wording is superseded. |
| D02 | Wallet holdings are crypto only; current asset scope is USDT. |
| D03 | Local-currency display follows the country selected during registration. |
| D04 | Zetmond controls the wallet keys in the live custodial model. |
| D05 | Users can receive from external wallets and send to external wallets. External-receipt charges are intended; amounts and the complete transfer-fee schedule remain TBD. |
| D06 | P2P crypto funding and crypto receipt must use Zetmond wallets. |
| D07 | Fiat is collected for a specific trade and paid to the seller's local bank account; it is not a user fiat-wallet balance. |
| D08 | The Vault supplies a crypto funding address and a unique fiat payment account for the trade. Address/account allocation mechanics remain TBD. |
| D09 | Advertisers publish fixed rates. Accepted order amounts are checked against that agreed rate. |
| D10 | Each party pays a **0.5% platform fee**, added to their required deposit. |
| D11 | The invoice itemises the fee before payment. |
| D12 | Cancelled trades carry no platform fee; deposited platform-fee amounts are returned. |
| D13 | Bank charges are separate from the platform fee. Bank charges for a fiat refund are deducted from the buyer's refund. |
| D14 | An unfunded trade expires after **20 minutes**. Once either party pays, the other has a fresh **15 minutes**. The latter replaces the unfunded deadline. |
| D15 | Users cannot cancel after either party pays. Pending payment situations at expiry enter review. |
| D16 | An incorrect fiat amount causes cancellation, refund to the buyer, and return of any deposited USDT to the seller. Both underpayment and overpayment are covered. |
| D17 | An incorrect in-app USDT funding amount is blocked, and the correct amount is shown. |
| D18 | KYC must be completed before wallet/trading use. |
| D19 | Advertiser eligibility includes identity verification, verified phone/email, bank-name match, and applicable security-deposit requirements. |
| D20 | Multiple advertiser categories: General (Beginner, Regular, Veteran), Verified (Bronze, Silver, Gold), and a separate Block category. Exact thresholds remain TBD. |
| D21 | Three separate product surfaces: public marketing site, user web app, and admin portal with separate login. |
| D22 | One admin role initially; admin access is not public registration. |
| D23 | Current delivery is responsive web, including desktop, tablet, phone, and intermediate widths. |
| D24 | Existing user-app colours and overall structure stay; the marketing site has a separate layout. |
| D25 | The product experience simulates integrations and funds. |
| D26 | No target delivery date has been set. |

**Country distinction:** choosing a display currency is not the same as enabling P2P settlement in that country. The Africa focus is confirmed; the first supported settlement markets are not.

## 4. Scope and product surfaces

### 4.1 Public marketing website

**Confirmed:** A separate landing experience, not the authenticated dashboard layout. It introduces the wallet, Vault, and P2P product and routes visitors to customer login or account creation.

**Proposed content:** product explanation, how the Vault works, fee examples, FAQs, support links, and policy links. Supported countries and payment methods must reflect approved capability rather than the presence of a flag or currency selector. product experience calls to action must make the sample status clear.

### 4.2 User application

Preserve the seven existing navigation sections:

1. Overview.
2. P2P Market.
3. Vault.
4. Activity.
5. Security.
6. Settings.
7. Support.

Advertiser functions belong within P2P. Subpages, drawers, and flow steps do not all become new sidebar items. The notification centre can open from the existing bell control.

### 4.3 Admin portal

A separate administrative login and management interface. One admin role handles the initial operational scope. The backend must distinguish customer and admin permissions; a different URL is not sufficient access control.

### 4.4 product experience versus live product

| Area | product experience | Intended live product |
|---|---|---|
| Accounts | sample accounts and illustrative verification flows | Authenticated accounts with implemented recovery and security controls |
| KYC | Fictional data and illustrative review outcomes | Approved provider/process, jurisdiction-specific requirements TBD |
| Crypto | Illustrative USDT balances, deposits, transfers, and confirmations | Custody and supported-network integration, design TBD |
| Fiat | Illustrative unique account details, receipts, and payouts | Eligible banking/payment partners and confirmed account capabilities |
| Fees | Agreed P2P fee calculation; unknown fees visibly TBD | Fully approved, disclosed fee and rounding policy |
| Operations | Illustrative admin review, failed payout, and refund scenarios | Operational procedures, reconciliation, monitoring, and escalation |

Monnify is the requested candidate for the naira payment flow. No eligibility or live integration approval has been confirmed. Do not infer support for other African currencies from that preference. Live provider selection and country coverage are open decisions.

## 5. Users, roles, and permissions

Buyer and seller are roles in a specific trade, not permanent account types. Advertiser category is separate from KYC status and from admin access.

| Actor | Intended access | Restrictions and open details |
|---|---|---|
| Visitor | View public site and policies; start login/sign-up | No access to private balances, trades, or admin functions |
| Registered user, KYC incomplete | Complete onboarding, verification, and account recovery | No wallet/trading use before KYC approval |
| KYC-approved customer | Wallet and eligible P2P order participation | Other contact/security prerequisites for non-advertisers remain TBD |
| Eligible advertiser | Publish/manage offers within approved tier rules | Does not gain admin powers or a manual Vault-release right |
| Admin | Review users, applications, trades, support, refunds, and operational exceptions | Exact high-impact action limits require review; no general balance-edit shortcut |

**Derived requirements:** Only the order's participants and authorised admin can see its private details. A seller cannot supply an arbitrary external wallet as the buyer's P2P recipient. A user cannot access another person's bank details or security settings by changing a record ID.

**Proposed admin controls:** Sensitive actions require a reason, actor identity, time, and audit entry. Single admin role does not mean shared administrator credentials. Permission boundaries and automatic versus manual refund approval must be settled before live handling.

## 6. End-to-end journeys

### 6.1 New customer

1. Read the public landing site and open the user app.
2. Create an account and select registration country.
3. Complete contact verification and KYC flow as applicable.
4. While KYC is incomplete, see progress and correction options rather than an enabled wallet.
5. After approval, see USDT holdings and the registration-country currency estimate.
6. Receive USDT, send USDT, or begin an eligible P2P trade.

The exact onboarding field set, identity documents, verification provider, and eligibility rules by country remain TBD.

### 6.2 External USDT deposit or withdrawal

**Receive:** Open Receive USDT, view the supported network and Zetmond address, read the applicable charge disclosure, and track a illustrative or live deposit through confirmation to credit.

**Send:** Enter a destination on the supported network, specify an amount, review applicable charges and recipient amount, authorise, and track the transfer result. Production confirmation counts, address rules, withdrawal limits, network, and fee amounts are TBD.

### 6.3 P2P trade

1. A user selects Buy USDT or Sell USDT and browses available fixed-rate offers.
2. The user selects an offer and enters a quantity within its limits.
3. The trade records the seller, buyer, USDT amount, fiat currency, fixed rate, and receiving accounts.
4. Each person sees their own fee-inclusive invoice and accepts the final terms. Whether publishing an offer counts as advertiser acceptance needs a decision.
5. The Vault presents the two relevant funding instructions. Either party may pay first.
6. While neither has funded, the trade has the agreed 20-minute unfunded window.
7. The first qualifying payment starts the fresh 15-minute window for the other party.
8. If both exact deposits qualify, the Vault coordinates delivery of principal amounts to the opposite parties.
9. Each payout is tracked separately. The trade is complete only after both obligations are fulfilled.
10. If a cancellation condition applies, the system initiates the applicable refunds and tracks them to completion.

### 6.4 Advertiser progression

1. Open the advertiser centre from P2P.
2. See identity, contact, bank-account, and security-deposit requirements.
3. Apply for a supported category and see application progress.
4. Following the approved eligibility process, create and manage offers.
5. See current category/level, benefits, and progress toward further eligibility.

Until numeric criteria are agreed, the product experience must label the relevant requirements as TBD or use explicitly labelled sample eligibility. It must not claim a real user has earned a tier using invented thresholds.

## 7. Accounts, KYC, and country settings

| ID | Requirement | Status |
|---|---|---|
| ACC-01 | Provide customer sign-up, login, logout, and recovery flows. | Derived requirement |
| ACC-02 | Capture registration country and map it to the displayed local currency. | Confirmed |
| ACC-03 | Require approved KYC before enabling wallet use or P2P trading. | Confirmed |
| ACC-04 | Advertisers must have verified phone and email contact details. | Confirmed |
| ACC-05 | Verify that bank-account ownership matches the legal identity used for KYC. | Confirmed advertiser rule; enforcement details TBD |
| ACC-06 | Show verification states: not started, incomplete, submitted, under review, approved, rejected/resubmission required. | Proposed UI states |
| ACC-07 | Keep identity-verification status distinct from advertiser category and level. | Derived requirement |
| ACC-08 | Prevent the client from bypassing KYC restrictions by directly calling a protected operation. | Derived requirement |
| ACC-09 | Provide an understandable reason and next step when verification cannot progress. | Derived requirement |

Country selection must not be replaced silently by device location. Whether users can later change registration country or display currency, and what re-verification that requires, is TBD. The screenshot's location-based suggestions and freely editable currency are not treated as confirmed rules.

Do not invent age eligibility, supported identity documents, KYC tiers, review duration, password policy, or OTP expiry. The exact mandatory two-factor authentication policy was not answered and remains open.

## 8. USDT wallet requirements

### 8.1 Balances and valuation

- **WAL-01 — Confirmed:** Hold USDT; do not show a spendable NGN, GHS, or other fiat balance.
- **WAL-02 — Confirmed:** Show an estimated local-currency equivalent based on registration country.
- **WAL-03 — Derived:** Distinguish available USDT, USDT committed to active trades, and any advertiser security deposit. None may be spent twice.
- **WAL-04 — Derived:** Explain whether a displayed total includes held funds so users can reconcile the total and available amounts.
- **WAL-05 — Proposed:** Show the valuation timestamp and label the local value as an estimate. FX source, refresh cadence, precision, and stale-rate behaviour are TBD.
- **WAL-06 — Confirmed:** The display valuation does not replace the accepted fixed rate for a P2P order.

### 8.2 Receive and send

- **WAL-07 — Confirmed:** Permit supported external USDT receipts and external sends after KYC.
- **WAL-08 — Confirmed:** Zetmond intends to charge for external receipts; the amount and calculation method are TBD. External send pricing is also unresolved.
- **WAL-09 — Derived:** Identify asset and network on the address screen and transfer review. Never imply any USDT network is accepted simply because the ticker is USDT.
- **WAL-10 — Derived:** Record transfer status, reference, principal, charges, and net credit/debit separately.
- **WAL-11 — Derived:** An external transfer that is pending, failed, or not yet sufficiently confirmed cannot be displayed as completed.
- **WAL-12 — Derived:** Insufficient available balance must block an outgoing transfer before commitment, including relevant charges.
- **WAL-13 — Proposed:** Provide address copy/QR, review, confirmation, and result screens; exact transfer authentication is TBD.

TRC-20/Tron appears in the old UI. The user's later answer explicitly confirmed external transfers but did not unambiguously select a network. **Network selection remains TBD.**

### 8.3 P2P funding from the Zetmond wallet

The product flow presents a Vault funding address and exact USDT amount. Seller funding and buyer receipt are Zetmond-only. The UI must block an incorrect seller funding amount, show the required amount, and the backend must enforce the same check.

Whether movement between Zetmond accounts uses internal ledger transfers, blockchain transactions, or a combination is an implementation decision, not a confirmed product rule. Do not infer blockchain fees on internal P2P funding. The custody and address model must be decided before live development.

## 9. P2P marketplace and advertiser requirements

### 9.1 Marketplace

| ID | Requirement |
|---|---|
| P2P-01 | Provide Buy USDT and Sell USDT views. |
| P2P-02 | Show advertiser identity, category/level where applicable, fixed rate, trade limits, and available quantity. |
| P2P-03 | Only show actionable offers for actually supported settlement markets. Display-currency selection alone does not activate a market. |
| P2P-04 | Let the user enter a trade quantity and calculate fiat principal and applicable invoice totals. |
| P2P-05 | Validate offer availability, trading limits, account eligibility, and rate before the agreement is finalised. |
| P2P-06 | Preserve the accepted order's rate when an advertiser later edits their offer. |
| P2P-07 | Ensure concurrent selections cannot sell the same available inventory multiple times. Exact reservation/replenishment design is TBD. |
| P2P-08 | Provide advertiser application and offer-management access within P2P. |

These requirements derive from the agreed marketplace and fixed-price flow. Suggested filters include currency, amount, and advertiser category. Exact sorting/ranking, review/rating rules, and whether informational chat exists are TBD. Negotiation is not required for the fixed-rate flow.

### 9.2 Advertiser categories

| Category | Levels | Confirmed purpose | Not yet decided |
|---|---|---|---|
| General | Beginner, Regular, Veteran | Multiple levels for standard advertising | Account age, completed trades, volume, completion-rate thresholds, limits, deposit |
| Verified | Bronze, Silver, Gold | Additional advertiser recognition and privileges | Qualification, benefits, approval, thresholds, deposit, downgrade rules |
| Block | Separate category | Larger-trade advertising | Minimum/maximum order sizes, financial evidence, deposit, access rules |

The structure was selected by reference to Bybit. This does **not** automatically adopt all Bybit rules, amounts, privileges, policies, or future changes. No 200 USDT or 1,000 USDT deposit is approved for Zetmond by this document.

### 9.3 Security deposit

- Treat the advertiser deposit separately from each trade's funding and from platform fees.
- Show required amount, deposited amount, locked status, and any release request status once policy is defined.
- Do not use locked advertiser collateral as freely available trading funds.
- Deposit amount by category, waiver rules, funding charges, release conditions, and any deduction/forfeiture authority are TBD.
- Seed sample advertisers for product experience testing; do not silently waive live rules to solve the initial marketplace supply problem.

## 10. Trade agreement, invoices, and charges

### 10.1 Required order agreement

Before funding, both parties must be able to review the same immutable trade terms:

- Unique order reference and participant identities.
- Buy/sell direction expressed from the viewer's perspective.
- USDT principal quantity and fiat settlement currency.
- Fixed exchange rate and resulting fiat principal.
- Each party's 0.5% platform fee and required deposit.
- Buyer Zetmond destination and seller's verified bank destination.
- Funding rules, cancellation rules, and refund-charge disclosure.
- Acceptance record and the applicable fee/rule version.

How acceptance is captured for an existing fixed-rate offer remains TBD. Bank or wallet destination changes after funding must not silently redirect the transaction; any exceptional correction requires a defined review process.

### 10.2 Confirmed P2P fee arithmetic

For USDT quantity **Q**, fiat units per USDT **R**, and fee rate **f = 0.005**:

| Item | Calculation before rounding |
|---|---|
| Fiat principal | Q × R |
| Seller platform fee | Q × f USDT |
| Seller required deposit | Q + (Q × f) USDT |
| Buyer platform fee | (Q × R) × f in settlement currency |
| Buyer required deposit | (Q × R) + ((Q × R) × f) in settlement currency |
| Buyer principal entitlement | Q USDT |
| Seller principal entitlement | Q × R fiat |

**Illustrative example only; not a live rate:** Q = 10 USDT and R = ₦1,300 per USDT.

| Participant | Principal | Platform fee | Required deposit | Receives on successful trade |
|---|---:|---:|---:|---:|
| Seller | 10 USDT | 0.05 USDT | **10.05 USDT** | **₦13,000 principal** |
| Buyer | ₦13,000 | ₦65 | **₦13,065** | **10 USDT** |

The example excludes separate bank charges. Who bears any successful payout charge, and whether it affects the seller's net bank receipt, is TBD. The invoice must distinguish principal entitlement from any approved separate deduction rather than promise a net amount that cannot be delivered.

### 10.3 Fee disclosure and cancellation

- **FEE-01:** Show the platform fee as both rate and currency amount before payment.
- **FEE-02:** Add each fee to the corresponding deposit; do not deduct it from the agreed trade principal.
- **FEE-03:** Do not display the seller's USDT fee as USD cash. For example, use “0.05 USDT”.
- **FEE-04:** Do not retain a platform fee on a cancelled trade. Refund any deposited fee amount along with the associated funds.
- **FEE-05:** Disclose separate bank charges; the platform fee does not cover them.
- **FEE-06:** Deduct actual applicable bank refund charges from the buyer's refund and itemise them. If the charge is unknown, do not invent a refund quote.
- **FEE-07:** Snapshot fee terms for the accepted order. Later configuration changes must not alter that order retrospectively.

Rounding mode, decimal precision, minimum fee, minimum order size, taxes, external-wallet charges, and charges that exceed a small refund are TBD. These are live-launch blockers. No tolerance for a fiat amount mismatch has been approved: the comparison is against the exact invoice amount under the eventual rounding policy.

## 11. Vault funding, timers, settlement, and refunds

### 11.1 Deposit instructions

**VLT-01:** Create a trade-linked Vault funding reference with separate crypto and fiat funding records.

**VLT-02:** Give the seller the Zetmond Vault crypto funding destination and the exact fee-inclusive USDT amount. Give the buyer the unique fiat collection account and the exact fee-inclusive fiat amount.

**VLT-03:** Both deposit routes are available after agreement; remove the old “seller funds first” condition. Each party sees the information relevant to their funding action and the other party's status.

**VLT-04:** The buyer pays into the Vault's collection account, not directly into the seller's bank account. The seller's bank account is the payout destination.

**VLT-05:** Track expected amount, observed amount, currency/asset, payment reference, source, and confirmation state. A screenshot or “I have paid” button is not verification of receipt.

Account allocation, reuse, closure, bank-account lifetime, late-payment mapping, and whether crypto addresses are unique per trade are TBD. The reference must still unambiguously identify which order owns a deposit.

### 11.2 Timer rules

| Condition | Rule |
|---|---|
| Agreement active and neither party has paid | 20-minute unfunded window |
| Either party pays first | Start a fresh 15-minute window for the other party immediately on that qualifying payment event |
| First payment arrives late in the unfunded window | Replace the original deadline; do not shorten the new 15-minute window |
| Both correct deposits qualify in time | Proceed to settlement |
| Neither pays before the unfunded deadline | Expire/cancel; no refund is needed if nothing was received |
| Only one has paid when the second window expires | Check for pending payment, then cancel and refund if no qualifying counterpart payment exists |
| Payment pending or uncertain at expiry | Enter payment review; do not concurrently refund and settle |

**Example:** If the first qualifying payment occurs 8 minutes after the order becomes active, the other party gets 15 more minutes. If it occurs at minute 19, the new deadline is minute 34.

The agreed baseline is to start the unfunded window when both parties have accepted the final trade. The UI acceptance mechanics remain open. “Paid” must be established from a trusted server/payment record, not a user assertion. The exact event used to start the funding clock—receipt time, confirmation time, or verified provider payment timestamp—and late notification treatment remain TBD.

**Derived safeguards:** Deadlines persist on the server, survive refresh/log-out, and do not reset on repeat notifications. A second browser or altered device clock cannot grant more time. The backend serialises deadline checks with deposit handling so a trade cannot both refund and settle.

### 11.3 Correct funding and settlement

Settlement eligibility requires both deposits to match the order, including fees, and to have the required verified status. Where checks are incomplete, show a review/processing state rather than a success message.

The Vault must track two obligations:

1. Deliver USDT principal to the buyer's Zetmond wallet.
2. Pay fiat principal, subject only to separately approved charges, to the seller's verified bank account.

Each obligation has its own reference, amount, status, attempt history, and result. Crypto credit and bank payout are not assumed to complete at the same instant. The order is **Completed** only when both are fulfilled.

If one succeeds and the other fails, retain the fulfilled result and recover the outstanding obligation. Do not automatically refund the original deposits as if no settlement occurred. Exact payout ordering, retry limits, review ownership, and reversal compensation are TBD. Duplicate events must never trigger duplicate credit or payout.

### 11.4 Incorrect fiat amount

**Confirmed outcome:** An underpayment or overpayment cancels the trade and triggers return of any received funds.

1. Compare the received gross payment amount with the expected invoice total; distinguish any provider deduction from the amount the buyer actually sent.
2. If the buyer paid the wrong amount, stop settlement and mark the cancellation reason.
3. Return the received fiat to the buyer's originating bank account, less the applicable refund bank charge.
4. Return any seller USDT already funded, including the deposited platform fee, to the seller's Zetmond wallet.
5. Track both returns separately until completion.

The flow does not invite a top-up or settle a smaller trade. If source-bank details cannot be verified, the refund remains under review rather than being redirected to an arbitrary account. Split payments, duplicated transfers, payment-source mismatch, and inability to identify the original bank account need the policies in Section 22.

### 11.5 User cancellation

- After either party pays, user-initiated cancellation is unavailable in both interface and backend.
- System cancellation for mismatch/expiry and admin exception handling are separate from a user's cancellation button.
- Whether a user may cancel before either party pays was not explicitly answered and remains TBD.
- A pending payment creates a race risk; treatment of cancel requests during that period must be decided before enabling manual cancellation.

### 11.6 Refund behaviour

| Situation | Required outcome |
|---|---|
| No payment at unfunded expiry | Cancel without platform fee |
| Seller only funded; buyer does not fund in time | Return seller's funded USDT including platform fee after pending-payment checks |
| Buyer only funded; seller does not fund in time | Refund buyer including platform-fee portion, less bank refund charge, after pending-payment checks |
| Wrong buyer fiat amount | Cancel, refund buyer less bank refund charge, and return any seller deposit including fee |
| Refund is pending | Show “Refund processing”; do not claim completion |
| Refund fails | Show failure/review status and an admin recovery path; preserve the outstanding refund obligation |
| Funds arrive after cancellation | Identify the original order and route the payment to a late-payment return/review process; never revive or settle the cancelled order automatically |
| Payout already succeeded on one side | Use settlement recovery, not ordinary pre-settlement cancellation |

For actual fiat received **A** and applicable bank refund charge **B**, the ordinary refund is **A − B**, with zero retained platform fee. Handling B ≥ A, fee reversals, and non-bank return costs remains TBD.

### 11.7 Proposed status model

These names are implementation proposals; the underlying business outcomes above are confirmed.

| Trade status | Meaning | Permitted next outcome |
|---|---|---|
| Agreement pending | Final terms not yet accepted by both parties | Active unfunded or abandoned under TBD policy |
| Awaiting funding | No qualifying deposit; 20-minute window active | One side funded, payment review, or unfunded expiry |
| Buyer funded / Seller funded | Exactly one side funded; 15-minute window active | Both funded, review, or cancellation/refunds |
| Payment review | Timing, source, amount evidence, or payment status is unresolved | Resume eligible flow or cancel/refund based on evidence |
| Ready for settlement | Both correct deposits verified | Settling |
| Settling | One or both payout obligations still in progress | Completed or settlement review |
| Settlement review | A payout failed or a completed-payment reversal needs investigation | Recovery to completed or explicitly authorised resolution |
| Completed | Both agreed payout obligations fulfilled | Historical receipt; any later reversal tracked as an exception |
| Cancelled | Trade will not settle | No-funds closure or refund work |

Track deposit, payout, and refund statuses separately from the trade status. A cancelled order can still have refunds processing, and a completed receipt must not hide a later reversal investigation.

## 12. Complete page and flow inventory

The following inventory expands the approved three-surface structure. “New” indicates absent from the seven supplied screenshots, not evidence that the user has never designed it elsewhere. Exact URL paths and whether a subflow uses a page, drawer, or modal remain design decisions.

### 12.1 Public website

| ID | Screen | Required purpose |
|---|---|---|
| PUB-01 | Landing page | Explain Zetmond, USDT wallet, Vault, fees, and product access; distinct marketing layout |
| PUB-02 | How it works / FAQs | Explain funding, timers, settlement, and refunds; may be landing-page sections |
| PUB-03 | Terms of service | Host approved terms; product experience placeholder must be identified |
| PUB-04 | Privacy notice | Explain approved data handling once established |
| PUB-05 | Vault/P2P and fee policies | Explain actual trade and refund rules; unknown policy stays marked TBD |

### 12.2 Customer access and onboarding

| ID | Screen | Key content |
|---|---|---|
| AUTH-01 | Create account | Account fields and links to approved terms |
| AUTH-02 | Email verification | Entry/resend/status flow; limits TBD |
| AUTH-03 | Phone verification | Contact binding and verification flow |
| AUTH-04 | Login | Customer credentials and recovery entry |
| AUTH-05 | Two-factor challenge | Conditional on final security policy |
| AUTH-06 | Forgot/reset password | Recovery request, reset, success/error states |
| ONB-01 | Country and currency setup | Registration country and associated display currency |
| ONB-02 | Identity details | Fields determined by the approved KYC process |
| ONB-03 | Identity evidence submission | Document/selfie requirements TBD; synthetic evidence only in product experience |
| ONB-04 | Verification status | Pending, approved, rejected, explanation, and resubmission |

### 12.3 Wallet and activity

| ID | Screen | Existing or new | Key content |
|---|---|---|---|
| APP-01 | Overview | Existing; update | USDT available/held amounts, local estimate, quick actions, recent activity, active trade summary |
| WAL-UI-01 | Receive USDT | New flow | Network, deposit address/QR, fee disclosure, deposit status |
| WAL-UI-02 | Send USDT | New flow | Destination, amount, validation, available balance |
| WAL-UI-03 | Transfer review/authorisation | New flow | Principal, charges, total debit/receipt, security step |
| WAL-UI-04 | Transfer result | New state/view | Pending, confirmed, failed; reference and next action |
| ACT-UI-01 | Activity | Existing; expand | Search/filter history across wallet, trades, fees, payouts, and refunds |
| ACT-UI-02 | Transaction detail/receipt | New | Amounts, references, status timeline, downloadable receipt |

### 12.4 P2P and advertisers

| ID | Screen | Existing or new | Key content |
|---|---|---|---|
| P2P-UI-01 | P2P Market | Existing; update | Buy/sell offers, fixed rates, availability, accurate Vault explanation |
| P2P-UI-02 | Advertiser profile | New | Category/level, activity metrics, offers; metric definitions TBD |
| P2P-UI-03 | Offer detail and amount | New | Terms, limits, quantity, calculated principal |
| ADV-UI-01 | Advertiser dashboard | New | Own offers, applications, tier, applicable limits |
| ADV-UI-02 | Eligibility/application | New | Verified contacts, KYC, bank match, applicable deposit requirements |
| ADV-UI-03 | Application status | New | Review result and any required corrections |
| ADV-UI-04 | Tier centre | New | General, Verified, Block structure; undecided thresholds labelled |
| ADV-UI-05 | Advertiser security deposit | New | Funding/locked/release states under approved future policy |
| ADV-UI-06 | Create offer | New | Fixed rate, direction, quantity, min/max, supported fiat market |
| ADV-UI-07 | My offers | New | Active/paused/closed list and controls |
| ADV-UI-08 | Edit offer | New | Changes affect future orders, not accepted trades |

### 12.5 Trade agreement and Vault

| ID | Screen | Existing or new | Key content |
|---|---|---|---|
| TRD-UI-01 | Receiving details | New | Seller's bank and buyer's Zetmond wallet; ownership checks |
| TRD-UI-02 | Agreement/invoice | New | Fixed rate, principal, fee line, exact deposit, applicable charges, acceptance |
| TRD-UI-03 | Waiting for acceptance | New if required | Counterparty acceptance under final acceptance model |
| VLT-UI-01 | Vault / My trades | New overview | Active, completed, cancelled, review, and refunding trades |
| VLT-UI-02 | Individual Vault trade | Existing; substantial update | Viewer-specific funding instructions, both deposit statuses, timer, both payout statuses |
| VLT-UI-03 | Settlement receipt | New | Confirmed delivered amounts and separate platform fees |
| VLT-UI-04 | Cancellation/refund detail | New | Reason, gross refund, bank charge, net return, separate return statuses |

Buyer and seller views can share one page structure, with role-specific instructions. They are not separate applications.

### 12.6 Security, settings, notifications, and support

| ID | Screen | Existing or new | Key content |
|---|---|---|---|
| SEC-UI-01 | Security overview | Existing; update | KYC status separate from advertiser level, protection settings |
| SEC-UI-02 | Two-factor setup/manage | New | Proposed security flow; mandatory-use policy TBD |
| SEC-UI-03 | Change password | New | Authorised password update and result |
| SEC-UI-04 | Devices/sessions | Existing entry; add detail | Session list, revoke/sign out, current-session indicator |
| SET-UI-01 | Settings overview | Existing; update | Links into profile, country/currency, contacts, banks, preferences |
| SET-UI-02 | Personal details | New subflow | Permitted edits; legal-identity changes require defined policy |
| SET-UI-03 | Country/display currency | New subflow | Confirmed registration mapping; later edit rules TBD |
| SET-UI-04 | Bank accounts | New | List verified payout accounts and status |
| SET-UI-05 | Add/verify bank account | New | Bank details and legal-name match result |
| SET-UI-06 | Email/phone changes | New | Re-verification and security policy TBD |
| SET-UI-07 | Notification/security-alert preferences | Existing entries; new controls | Supported channels and preferences; channel policy TBD |
| NOT-UI-01 | Notification centre | New | Relevant trade, verification, wallet, and support events |
| SUP-UI-01 | Support home | Existing; update | Help categories and trade-linked case entry |
| SUP-UI-02 | Help article | New | Plain-language guides to actual functionality |
| SUP-UI-03 | Submit case/report trade | New | Linked reference, issue category, description, evidence |
| SUP-UI-04 | My cases | New | User's case list and status |
| SUP-UI-05 | Case detail/conversation | New | Replies, evidence, status, resolution |

### 12.7 Admin portal

| ID | Screen | Purpose |
|---|---|---|
| ADM-UI-01 | Admin login | Separate access; authentication policy to be finalised |
| ADM-UI-02 | Admin dashboard | Operational queues and exceptions |
| ADM-UI-03 | Users and user detail | Account/KYC status, associated activity, permitted actions |
| ADM-UI-04 | KYC queue/review | Synthetic review in product experience; live process TBD |
| ADM-UI-05 | Advertiser applications/review | Category application and requirement checks |
| ADM-UI-06 | Advertiser detail/tier/deposit | Tier and collateral status; action policy TBD |
| ADM-UI-07 | All trades/trade detail | Agreement, deposits, deadlines, payouts, refunds, event history |
| ADM-UI-08 | Deposits and payouts | Pending/failed/confirmed records and references |
| ADM-UI-09 | Refund queue/detail | Outstanding returns, bank charges, completion evidence |
| ADM-UI-10 | Payment review/reconciliation | Mismatches, late funds, duplicates, and uncertain payments |
| ADM-UI-11 | Support queue/case | User support and trade-linked review |
| ADM-UI-12 | Fee records | Collected, refundable, and returned fee amounts by currency/asset |
| ADM-UI-13 | Operational configuration | Proposed settings for approved markets/limits/fees; no retrospective order changes |
| ADM-UI-14 | Audit history | Who did what, when, why, and on which record |
| ADM-UI-15 | Admin account security | Own credentials/sessions; no multi-role permission editor in initial scope |

The earlier suggested multi-role admin management screen is superseded by the decision to have one admin role. Provisioning additional admin accounts and approval limits still need a policy.

### 12.8 Reusable system states

Design loading, empty history, no matching offers, zero balance, insufficient balance, invalid amount, network unavailable, session expired, access denied, account restricted, service unavailable, and page-not-found states. For each, provide a clear message and a safe next action. Financial operation status must be recovered after reconnection before offering a repeat action.

## 13. Design and responsive behaviour

### 13.1 Preserve the supplied visual identity

The seven screenshots establish the user-app visual reference: dark-purple left sidebar, purple action buttons/gradients, pale lavender background, white rounded cards, slim header, mixed serif display headings and sans-serif interface text.

**Confirmed:** Retain the colours and overall structure. **TBD:** Exact source fonts, colour tokens, spacing values, illustration assets, and responsive layouts. Do not claim sampled approximations are the original design values. Prefer original design/code assets when supplied; any reconstructed tokens need visual review.

### 13.2 Updates to existing screens

| Existing screen | Required change |
|---|---|
| Overview | Preserve crypto-only model; add clear available/held separation; align country display with registration; replace outdated Vault copy |
| P2P Market | Remove claims that the Vault holds only USDT and fiat settles directly with the seller; remove seller-must-fund-first instructions |
| Vault | Replace direct seller mobile-money payment details with Vault collection details; add invoice fees, both funding statuses, correct timers, and seller payout tracking |
| Activity | Include fee, payout, cancellation, refund, and detail states; describe internal holds clearly |
| Security | Separate identity verification from advertiser tiers; provide incomplete/rejected KYC states; repair missing illustration |
| Settings | Align currency behaviour and bank-account management with confirmed rules; disable unapproved changes |
| Support | Explain two-sided Vault flow and refund bank charges; add case tracking |

The Vault screenshot also contains a missing illustration. Replace it with an available approved asset rather than leaving broken-image text. Technical text such as “signed provider event” should appear as plain language such as “Checking your payment” on customer screens. Operational details belong in admin records.

### 13.3 Responsive and accessible interaction — proposed acceptance baseline

- Reflow cards and forms for narrow screens; keep the established desktop navigation recognisable through a mobile drawer or equivalent, subject to design review.
- Keep primary payment actions, exact amounts, fees, and remaining time visible without clipping.
- Do not rely on hover or colour alone to convey status.
- Support keyboard navigation, clear focus, labelled fields, and announced validation messages.
- Prevent accidental double-submit and show feedback while an action is running.
- Support small phones, tablets, laptops, wide displays, and intermediate widths; test at representative sizes rather than assuming fixed devices.
- Avoid layout shifts that move a confirmation button during payment review.
- Preserve user-entered information safely after a validation error; never recover or display secret credentials.

Exact breakpoints, accessibility conformance target, browser support, and performance budgets remain to be approved.

## 14. Admin portal and operations

**Confirmed:** One admin role and separate login. The following operations are proposed to support agreed workflows; exact authority for financial exceptions must be approved before live use.

| ID | Operational requirement |
|---|---|
| ADM-01 | View users, verification state, and linked relevant records. |
| ADM-02 | Review illustrative KYC and advertiser applications against configured rules. |
| ADM-03 | Inspect the complete trade timeline, original invoice, and deadline evidence. |
| ADM-04 | See each deposit, payout, and refund independently. |
| ADM-05 | Investigate uncertain or late payments without marking them successful solely from user-uploaded proof. |
| ADM-06 | Initiate an authorised retry of an outstanding payout/refund without duplicating a completed movement. |
| ADM-07 | Review support cases and communicate a recorded outcome. |
| ADM-08 | See platform fees by asset/currency, separating pending/refundable amounts from collected amounts. |
| ADM-09 | Audit sensitive changes and actions; retain original history rather than overwriting it. |
| ADM-10 | Separate sample controls from ordinary customer functionality. |

No unrestricted “edit balance”, “release anyway”, or “mark paid” action is approved. Operational correction must preserve traceable financial records and respect completed obligations. Suspension powers, exception approval limits, automatic refund authority, and admin provisioning are open decisions.

## 15. Activity, notifications, and support

### 15.1 Activity and receipts

Activity should cover external deposits/withdrawals, Vault funding, settlement, platform-fee collection/return, advertiser deposits, and refunds when those features are enabled. Each row links to a detail record with the relevant reference, amounts, timestamp, status, and related trade.

Invoices are requests for payment; receipts evidence completed movements. A pending order should not generate a document falsely declaring successful payment. Receipts must show the actual asset/currency rather than treating USDT as fiat dollars.

### 15.2 Notifications

**Proposed:** Notify the affected user of verification outcomes, invoice acceptance where applicable, first-party funding and timer start, receipt/validation of their own payment, settlement progress/completion, cancellation, refund progress/failure, security events, and support replies.

In-app notification links should open the relevant record. Reminder times, email/SMS/push channels, mandatory security notices, and retention remain TBD. A notification failure must not change a financial deadline or duplicate a payout.

### 15.3 Support and disputes

Users need a trade-linked way to report missing payments, unexpected charges, failed refunds, and account issues. Evidence can assist investigation but does not directly authorise release. Show case ID, status, conversation, and outcome.

Support response targets, appeals, evidence limits, dispute liability, and final resolution authority are TBD. Do not advertise a guaranteed response/refund time that has not been set.

## 16. Logical records and system boundaries

### 16.1 Conceptual records — proposed, not a database schema

| Record | Essential responsibility |
|---|---|
| User/account | Identity, registration country, contact status, KYC link, security state |
| Bank account | Owner, bank/country/currency, verification state, protected destination details |
| Wallet | USDT owner/account association and supported transfer capabilities |
| Ledger movement | Traceable debit/credit/hold/release/fee/refund entries and related references |
| Advertiser profile | Category, level, qualification state, limits, security-deposit link |
| Offer | Direction, fixed rate, fiat market, quantity, limits, availability, version |
| Trade agreement | Immutable accepted rate, parties, principal, destination snapshot, rule/fee version |
| Invoice | Participant-specific required principal, fee, total, rounding policy, acceptance |
| Vault deposit | Expected/observed amount, source, reference, state, evidence, received/confirmed timestamps |
| Payout obligation | Recipient, asset/currency, amount, attempts, status, final reference |
| Refund obligation | Original payment, reason, gross amount, bank charge, net refund, status |
| Provider event | Unique event reference, authenticity result, processing state, related movement |
| Support case | Reporter, related order, evidence, replies, status, resolution |
| Audit event | Actor, action, time, reason, affected record, before/after reference |

### 16.2 Financial integrity

**Derived requirements:** Record funds already received even when they do not match an order. Keep deposits, custody obligations, pending payouts, refunds, and platform-fee obligations distinguishable. Never treat fiat collected for a trade as a general customer fiat wallet. Use exact monetary arithmetic with approved rounding, not binary floating-point approximations for payable amounts.

**Proposed implementation:** A double-entry ledger and server-authoritative trade state engine. The final database, backend framework, hosting, queue, custody provider, and blockchain integration remain TBD. This PRD does not commit to React, NestJS, Express, PostgreSQL, MongoDB, or any other stack.

### 16.3 System responsibilities

| Component | Responsibility |
|---|---|
| Public site | Marketing and entry to the product |
| User app | User-facing forms, balances, offers, trade progress, settings, and support |
| Admin portal | Authorised review, exception handling, and audit visibility |
| Shared backend | Authentication, permissions, exact calculations, state, deadlines, records, and orchestration |
| Crypto adapter | Illustrative now; live custody/network events and sends later |
| Fiat adapter | Illustrative now; eligible live collection, verification, payout, and refunds later |
| Verification adapter | Illustrative now; approved live KYC/contact checks later |

Independent interfaces must use consistent backend facts. Neither the marketing site nor the customer app can declare itself an admin or override a payment state.

## 17. Security, reliability, and quality requirements

These are derived engineering safeguards or proposed launch gates, not claims that the product experience provides production-grade custody.

- Enforce authentication, object ownership, KYC gating, and admin authorisation on the server.
- Validate financial amounts, destinations, and state transitions independently of disabled UI buttons.
- Keep live keys and provider secrets out of browser code and logs; no live keys are used in the product experience.
- Verify live payment events using the eventual provider's supported authenticity and transaction-verification mechanisms.
- Make event processing and monetary actions idempotent: repeated requests or notifications do not move funds twice.
- Reconcile records with external payment/custody evidence; investigate unknown or conflicting movements.
- Recover deadlines and ongoing obligations after restart, browser close, or connection loss.
- Protect personal data and mask sensitive bank/contact details outside authorised contexts.
- Preserve an append-only or equivalently tamper-evident audit trail for sensitive operations.
- Separate customer help content from internal provider messages and secrets.
- Rate-limit sensitive operations under an approved policy; exact limits and account-lockout rules are TBD.
- Define tested backup/restore, monitoring, incident response, and recovery objectives before live launch; numeric targets are TBD.
- Complete independent security review and eligible partner/custody arrangements before real-money operation.

Country-specific licensing, customer eligibility, privacy retention, screening, and required disclosures need specialist confirmation for the actual launch scope. No regulatory approval or legal conclusion is asserted in this PRD.

## 18. product experience specification

### 18.1 Purpose

Explain the complete intended user experience and exercise the confirmed financial rules without real money. The product experience should be functional enough to test buyer, seller, and admin perspectives, rather than a set of disconnected static screenshots.

### 18.2 Illustration requirements

- Clearly label the product environment and balances as illustration/illustrative.
- Use fictional users, bank details, KYC evidence, and mock addresses that cannot be mistaken for real funding instructions.
- Provide buyer, seller, and admin test sessions so the same trade can be observed from each role.
- Simulate correct funding, no funding, wrong fiat amount, pending payment, payout failure, refund failure, and late payment.
- Preserve state across page navigation and refresh within the product experience's chosen persistence model; that model remains TBD.
- Calculate the agreed P2P 0.5% fees using exact decimal arithmetic.
- Keep unapproved advertiser criteria and external-transfer fees visibly unresolved.
- Provide sample-only controls for advancing time and producing payment events. These must not be customer controls in the live product.
- Use the actual 20-minute/15-minute rules; an accelerated sample clock must say it is accelerated rather than silently changing policy.
- Permit safe sample reset without connecting to live services.

### 18.3 product experience coverage

The full page inventory defines the product scope. A proposed first implementation slice is: shared user-app layout, sample login/KYC gating, wallet overview, marketplace, invoice/acceptance, both-role Vault views, activity/receipt, and a small admin exception view. Other pages follow in the sequence in Section 20; they are not removed from the complete product definition.

Native apps and live integration are not part of this product experience. A successful sample is not evidence that production custody, settlement eligibility, or regulatory readiness has been established.

## 19. Acceptance scenarios

All monetary examples are fixtures. Open-policy-dependent checks cannot be signed off until the linked decision is resolved.

| ID | Scenario | Expected result |
|---|---|---|
| AC-01 | KYC is incomplete and user attempts wallet funding/send/P2P | Operation blocked; verification next step shown; backend also rejects bypass |
| AC-02 | User registers with an approved country mapping | USDT shown with that country's local estimate; no fiat-wallet balance implied |
| AC-03 | Display FX changes after trade agreement | Wallet estimate may change; agreed P2P rate and invoice remain unchanged |
| AC-04 | Trade is 10 USDT at ₦1,300 | Seller invoice 10.05 USDT; buyer invoice ₦13,065; each fee explicitly shown |
| AC-05 | Seller enters 10 instead of required 10.05 USDT | Send disabled, exact amount shown, backend prevents incorrect Vault funding |
| AC-06 | Buyer pays first with exact invoice amount | Buyer funding recorded; fresh 15-minute seller countdown starts |
| AC-07 | Seller pays first with exact invoice amount | Seller funding recorded; fresh 15-minute buyer countdown starts |
| AC-08 | First qualifying payment occurs at minute 19 | New deadline is minute 34, not minute 20 |
| AC-09 | Neither party pays for 20 minutes | Order expires; no platform fee and no fabricated refund |
| AC-10 | Only one party funds, second window expires, no pending payment | Cancel and return received funds under refund-charge rules |
| AC-11 | Payment is pending at deadline | Trade enters review; no automatic refund and settlement race |
| AC-12 | Buyer pays too little | Cancel; buyer refund less bank refund charge; seller deposit and fee returned if present |
| AC-13 | Buyer pays too much | Same cancellation/refund outcome; do not keep excess or revise trade quantity |
| AC-14 | Either party attempts cancellation after first payment | UI offers no cancel action and backend rejects the request |
| AC-15 | Both exact deposits verified | Vault initiates both obligations without requiring seller release approval |
| AC-16 | Buyer crypto credited; seller bank payout still pending | Show partial settlement progress, not full completion |
| AC-17 | One payout fails after the other succeeds | Preserve success and retry/review outstanding obligation without duplicate payment |
| AC-18 | Same payment event delivered twice | One recorded financial effect; no restarted timer or duplicate settlement |
| AC-19 | Refresh or device-clock change during countdown | Same server deadline and financial state recovered |
| AC-20 | Wrong amount is refunded | Show gross received, zero retained platform fee, bank charge, and net return |
| AC-21 | Refund fails or remains pending | Keep obligation open and visible to user/admin; do not mark refunded |
| AC-22 | Late payment arrives for cancelled order | Link to original order and return/review; do not reactivate trade automatically |
| AC-23 | Advertiser edits an offer after order acceptance | Existing order unchanged; future orders use new rate/terms |
| AC-24 | Customer tries another user's trade or admin operation | Access denied without exposing private data |
| AC-25 | P2P buyer supplies external wallet as recipient | Reject; P2P receipt must use buyer's Zetmond wallet |
| AC-26 | User sends to external wallet outside P2P | Use wallet transfer flow under approved network/fee policy; not blocked merely by P2P-only restriction |
| AC-27 | Tier requirements have no approved numeric values | Show TBD/sample status, not fabricated live qualification |
| AC-28 | Two orders compete for same available funds | Prevent over-allocation and double spending |
| AC-29 | Customer uses phone/tablet/desktop widths | Core flows usable; exact amounts and primary actions not clipped |
| AC-30 | Mock event controls used | Clearly sample-only; no live transfer or identity submission occurs |
| AC-31 | An unavailable country/currency is selected for P2P | Show unavailable settlement capability even if local estimate can be displayed |
| AC-32 | A receipt is downloaded before both payouts complete | It reflects actual partial/pending state; never asserts full trade completion |

### 19.1 Cases awaiting policy before final acceptance

- First payment at the exact deadline, or received before expiry but notified afterwards.
- Split fiat payments, duplicate transfers, and a correct payment followed by an extra transfer.
- A payment from a bank account whose holder does not match KYC.
- A fee-inclusive amount below supported rounding precision.
- Bank refund cost greater than or equal to the amount received.
- Reversal after a completed settlement.
- Manual cancellation before either party funds.
- External deposit/withdrawal charges and unsupported-network receipt handling.

Until decided, simulate these as explicit review cases rather than inventing automatic economic outcomes.

## 20. Delivery sequence and readiness gates

This sequence is **proposed**; no dates, budget, team capacity, or framework are assumed. The user is building with the assistant.

| Stage | Deliverable | Exit condition |
|---|---|---|
| 1. Product and design alignment | Review this PRD, confirm blockers, obtain source assets where possible | Confirmed rules separated from TBD; shared visual direction understood |
| 2. Web foundation | Chosen stack, shared shell/components, customer/admin separation, sample accounts | Responsive navigation and basic role boundaries work |
| 3. Core trade product experience | Marketplace, fixed-rate invoice, both-role Vault funding, fees and timers | Core successful and cancelled trade scenarios pass |
| 4. Recovery and operations | Payment review, payout/refund exceptions, activity, admin queues | Duplicate/pending/late/failure scenarios are traceable |
| 5. Complete user journeys | Onboarding/KYC illustration, wallet transfers, advertisers, settings/support, marketing site | Page inventory implemented or explicitly phased with owner agreement |
| 6. product experience review | Responsive and functional validation | Owner can walk through buyer, seller, and admin flows; limitations visible |
| 7. Live-product planning | Country/provider/custody decisions, external fees, legal/security work, operating procedures | All real-money blockers resolved before a live pilot |

The first code delivery should preserve the screenshot design rather than replace it with an unrelated template. Deployment method, private/public product experience access, domains, and local-versus-hosted workflow require a decision before deployment.

## 21. Measures of success

The following measures are **proposed**, with no numeric commercial targets approved:

| Measure | Definition or purpose |
|---|---|
| product experience scenario coverage | Agreed acceptance scenarios complete |
| Invoice comprehension | Test users can identify principal, fee, total deposit, and expected receipt |
| KYC funnel | Submitted/approved/rejected verification journeys and drop-off points |
| Funding completion | Accepted orders reaching both deposits, separated from unfunded expiry |
| Settlement completion | Trades where both payout obligations are fulfilled |
| Cancellation reasons | Unfunded expiry, second-party timeout, mismatch, and reviewed exceptions separately |
| Time to settlement | Time from both qualifying deposits to both payouts completed |
| Refund completion time | Time from refund obligation creation to confirmed return |
| Financial integrity | Duplicate monetary effects, unreconciled movements, and outstanding obligations |
| Platform fees | Collected amounts separated by fiat currency and USDT; cancelled-order fees excluded |
| Support demand | Cases by cause, unresolved age, and resolution outcome |

Do not combine USDT and fiat fee totals into one revenue figure without a defined reporting conversion method. Advertiser completion-rate calculations and whether counterpart-caused cancellations affect a user are TBD.

## 22. Open decisions and questions

These items are deliberately unresolved. “TBD” is not a default of zero, unlimited, approved, or free. The product owner must answer before affected live behaviour is enabled.

| ID | Decision needed | Why it matters | Blocking scope |
|---|---|---|---|
| O01 | Exact registration countries and supported P2P fiat markets | Display currency and settlement capability differ | Country-specific live launch; product experience menu content |
| O02 | USDT network(s) | Address validation, confirmation, fees, and recovery depend on it | Live wallet; network-specific product experience copy |
| O03 | Custody/address design and Vault transfer mechanism | Defines key control, address issuance, internal movement, and costs | Live crypto |
| O04 | External receipt charges and external withdrawal fees | User confirmed charging for receipts without setting prices | Wallet fee quotations |
| O05 | Display FX source, refresh, stale handling, country/currency edits | Prevents misleading estimates and unsupported currency changes | Valuation/settings |
| O06 | Live fiat partner eligibility and country coverage | Monnify preference is not confirmed permission or multi-country support | Live fiat |
| O07 | Unique account allocation/reuse/lifetime and refund source details | Needed for matching, late payments, and returning to the payer | Live Vault collection/refunds |
| O08 | Advertiser security deposits, limits, performance thresholds, benefits | Category names are agreed; numeric qualification is not | Actual advertiser qualification |
| O09 | Advertiser approval/upgrade/downgrade and deposit-release rules | Defines who can post and when collateral is returned | Advertiser operations |
| O10 | Fixed-offer acceptance mechanics | Does the advertiser pre-accept by posting or accept each order? | Start of order and 20-minute window |
| O11 | Precise trusted event that counts as first payment and deadline boundary policy | Handles receipt versus confirmation and delayed notifications | Production timer enforcement |
| O12 | Split payments, extra/duplicate transfers, partial crypto exceptions | Exact-match rule alone does not define all multi-event cases | Payment exception automation |
| O13 | Manual cancellation before first payment | Only post-payment user cancellation was explicitly prohibited | Pre-funding cancel control |
| O14 | Sender-bank mismatch and unidentifiable refund source | Name-match rule needs a safe exception process | Live refunds and third-party payment handling |
| O15 | Successful bank collection/payout charge payer and quote method | Charges are separate, but successful-settlement allocation is undecided | Accurate net-receipt invoices |
| O16 | Decimal precision, rounding, minimum fees/orders, taxes | Determines the exact amount that the Vault accepts | Live monetary calculation |
| O17 | Refund fee ≥ received amount and any non-bank refund costs | Cannot silently create a negative refund or unapproved charge | Small/exceptional refunds |
| O18 | Payout ordering, retry limits, review duration, reversal recovery | Needed when one side completes and the other fails | Live settlement recovery |
| O19 | KYC provider, fields, documents, age/eligibility and country policies | KYC-first is confirmed; verification process is not | Live onboarding |
| O20 | Mandatory 2FA, password/recovery, session and lockout policies | User confirmed KYC but did not answer the 2FA policy | Live account security |
| O21 | Admin provisioning, sensitive-action limits, refund approval authority | One role does not define unrestricted financial authority | Live admin operations |
| O22 | Ordinary customer phone/email prerequisites beyond KYC | Explicit verified-contact rule was given for advertisers | Customer onboarding |
| O23 | Offer sorting, metrics, reviews, chat, availability/reservation rules | Needed for consistent marketplace behaviour | Marketplace refinement |
| O24 | Notifications, support targets, disputes, evidence/retention and appeals | These service promises have not been set | Live support/policies |
| O25 | Technology stack, hosting, persistence, repo and work environment | Prior technologies were suggestions, not decisions | Implementation setup |
| O26 | Domains, deployment access and publication approval | Three separate surfaces are agreed, actual hosting is not | Deployment |
| O27 | Source fonts/assets/design tokens, responsive details | Screenshots establish appearance but not exact source values | Visual implementation fidelity |
| O28 | Performance/accessibility/browser targets, backups, retention, incident procedures | Production quality and operating thresholds require agreement | Live readiness |
| O29 | Budget, expected users and delivery schedule | No target date was given; no capacity assumptions should be invented | Planning, not initial product experience specification |

For the next product discussion, prioritise O01–O04, O08–O11, O15–O16, and O25. Other uncertain scenarios can be represented as clearly labelled product experience review states while policy is resolved.

## 23. Reference material and glossary

### 23.1 Evidence basis

This PRD is based on the product-owner decisions in the Zetmond conversation through 19 October 2026 and the seven supplied desktop screenshots reviewed in that conversation:

| Filename | Evidence used |
|---|---|
| zetmond home page.png | Existing overview, USDT display, purple branding, sidebar, local estimate |
| zetmonf p2p market.png | Existing marketplace, fixed-rate offers, buy/sell controls, outdated escrow copy |
| zetmond vault.png | Existing single-trade view, outdated direct-seller fiat instructions and seller-first flow |
| zetmond activity page.png | Existing activity table and transaction presentation |
| zetmond support page.png | Existing support entry and help categories |
| security page.png | Existing security summary, sessions, and verified identity state |
| settings page.png | Existing settings groups and policy links |

The old screenshots are visual references, not authoritative specifications of the revised Vault. Their GHS/NGN tabs, mobile-money entries, TRC-20 text, and “Tier 2 verified” label do not independently approve those countries, payment rails, network, or account-tier policy.

Advertiser category names were selected using Bybit as a reference in the discussion. This PRD does not rely on external rules as binding Zetmond policy and does not certify current provider availability or regulatory requirements. The existing business plan has not been edited or treated as an override of the owner's latest instructions.

### 23.2 Glossary

| Term | Meaning in Zetmond |
|---|---|
| Custodial wallet | Account-based crypto wallet whose keys are controlled by Zetmond or its eventual custody arrangement |
| Local-currency estimate | Indicative display value of USDT, not a fiat-wallet balance |
| USDT seller | Person supplying USDT and receiving fiat in a bank account |
| USDT buyer | Person supplying fiat and receiving USDT in their Zetmond wallet |
| Advertiser | Eligible user who publishes a fixed-rate buy or sell offer |
| Vault | System coordinating both trade deposits, verification, settlement, and cancellation/refund handling |
| Principal | Agreed exchanged amount before platform fees and separate approved charges |
| Platform fee | 0.5% charged to each party on a successful P2P trade, funded in addition to principal |
| Security deposit | Advertiser collateral under a policy still to be defined; distinct from trade funding |
| Invoice | Pre-payment record of required amounts and agreed terms |
| Receipt | Evidence of actual completed movements, with truthful status |
| Payment review | Non-terminal investigation state when payment evidence or timing is unresolved |
| Settlement | Fulfilment of buyer USDT and seller fiat obligations |
| Refund | Return of received funds when a trade will not settle, with applicable refund bank charge disclosed |
| Idempotency | Reprocessing the same action/event does not move funds again |

---

**End of PRD v1.0.** Confirmed rules are ready for review and product experience implementation. Proposed controls and TBD policies require the product owner's decisions before they become live product commitments.
