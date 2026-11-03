# Zetmond — Production Web Application PRD

## Desktop, tablet and mobile web

| Document field | Value |
|---|---|
| Version | 1.1 — production specification with owner decision review |
| Prepared | Original: 28 October 2026; decision review recorded: 3 November 2026 · Africa/Lagos |
| Product | Zetmond custodial USDT wallet and P2P marketplace |
| Delivery intent | A production service for real users, real identity verification and real funds |
| Document status | Owner-approved decisions recorded in Section 23; remaining details and launch blockers remain explicit |
| Primary source | `Zetmond_Product_Requirements_Document_v1.0.md`, dated 19 October 2026 |
| Authoritative update | Production scope retained; owner decision review and shared-login correction incorporated on 3 November 2026 |
| Platforms | Responsive browser application: desktop, tablet, phone and intermediate widths |
| Related surfaces | Existing public marketing site; customer web application; separate admin portal |
| Schedule | No launch date or delivery estimate has been approved |
| Intended readers | Product owner, frontend and backend engineers, designers, QA, security, operations and implementation collaborators |

> **Implementation contract:** Production features must use authenticated backend services and durable records. Customer balances, KYC decisions, funding, settlement and refunds must reflect verified events. Mock balances, simulated payment buttons, browser-only trade state and arbitrary approval switches cannot satisfy production acceptance.
>
> This is a new companion PRD. It does not overwrite the main PRD, business plan, existing website or source repository. It carries forward confirmed product rules and replaces the main PRD's prototype delivery scope for this web-app build. The product is not certified launch-ready merely because this document exists.

---

## Revision 1.1 — authority and decision status

This revision preserves the uploaded v1.0 production requirements and records the owner's subsequent answers to O01–O29 in Section 23. It also replaces Section 21.1 with the requested ten-task sequence: **Vault is Task 9, second to last; the admin portal is Task 10, last**.

**Precedence:** the explicit decisions in Section 23 and the shared-login correction below supersede conflicting v1.0 proposed baselines, unresolved-policy wording, visual references and earlier main-PRD statements. References elsewhere to an O-number mean its current Section 23 entry; approval of a baseline does not resolve that entry's remaining TBD details. Unchanged technical safeguards and acceptance requirements remain applicable. This revision records decisions, not completed implementation, verified provider capabilities or permission to accept real funds.

**Shared-login correction:** customers and administrators use the same login page. Admin accounts are provisioned in advance by the owner, with securely hashed passwords and mandatory authenticator-app MFA. The backend determines the authenticated account's role and redirects to the customer app or separate admin portal. Admin APIs enforce authorization independently of the redirect, URL or client-provided role. There is no public admin signup. Customer access never grants admin access.

**Current delivery context:** budget and launch volume are TBD, no launch date is set, and development is planned with the product owner and AI assistant. Operational responders, independent assessments and any specialist responsibilities must still be assigned before launch; they are not supplied by this development arrangement.

The original uploaded v1.0 file and the existing main PRD are preserved unchanged. No application implementation or provider selection is claimed by this document.

---

## Contents

1. Document authority and requirement labels
2. Product purpose, outcomes and scope
3. Confirmed business rules
4. Users, access and account states
5. Product surfaces and information architecture
6. Responsive design and accessibility
7. Onboarding, authentication and KYC
8. Wallet overview, deposits and withdrawals
9. Marketplace and advertiser centre
10. Agreement, receiving accounts and invoices
11. Vault funding and deadlines
12. Settlement, cancellation and refunds
13. Activity, notifications, settings and support
14. Admin portal and operations
15. Complete screen and state inventory
16. Backend responsibilities and data requirements
17. Integration and provider requirements
18. Security, privacy and custody requirements
19. Reliability, performance and service operations
20. Production acceptance scenarios
21. Delivery sequence and release gates
22. Measurement and analytics
23. Owner decision register and remaining TBDs
24. Traceability to the main PRD
25. References and glossary

---

## 1. Document authority and requirement labels

### 1.1 Order of authority

Section 23 records the latest owner decisions incorporated in this revision and takes precedence over earlier conflicting wording.

1. The product owner's latest explicit decisions in the Zetmond discussion.
2. Confirmed business rules in the current main PRD.
3. Derived requirements needed to enforce those rules consistently in production.
4. Proposed design and technical baselines in this document, pending review.
5. Existing screenshots, generated UI images and the clickable design preview as visual references.

A preview screen is not approval of a business policy. A displayed country, network, deposit threshold, example rate, security step or button does not establish a production rule.

### 1.2 Requirement labels

| Label | Meaning | Implementation treatment |
|---|---|---|
| **Confirmed** | Explicit owner decision or confirmed main-PRD rule | Preserve unless owner changes it |
| **Required safeguard** | Necessary to protect the correctness of a confirmed flow | Implement and test; equivalent technical solutions are acceptable |
| **Proposed baseline** | Suggested UI, architecture or operating target | Review before freezing the implementation contract |
| **Decision required** | Policy, commercial term or provider capability not yet approved | Resolve before enabling the affected production operation |

“Must” denotes an acceptance requirement within its stated status. A proposed baseline remains proposed even where its acceptance criteria use “must.” No TBD means free, unlimited, zero-fee, supported or automatically approved.

### 1.3 Explicit changes from the main PRD

| Main PRD material | Production treatment |
|---|---|
| Cover: current delivery is a responsive web prototype | Superseded: current target is a production responsive web application |
| D25 and Section 18: simulated integrations and funds | Superseded for customer production use; mocks remain only in isolated development/test environments |
| Section 4.4: prototype/live split | Live requirements define delivery acceptance; sandbox testing is a verification step |
| Section 20: prototype-first delivery sequence | Replaced by the production implementation and release gates in Section 21 below |
| AC-30: mock event controls | Replace with a check that test controls cannot execute or appear in production |
| “Live planning later” wording | Provider, custody, policy and operational readiness become prerequisites for the affected real-money features |

Manual unfunded cancellation is approved under O13 only when neither party has paid and no payment is pending. The backend must recheck these conditions atomically; uncertain evidence enters review.

The generated mobile image is a visual concept, including fictional balances and advertisers. Its text, activity statistics and example rates are not live policies or data.

### 1.4 Definition of complete

A feature is complete when its responsive screens, backend behaviour, authorization, durable records, integrations, failure handling, administrative visibility and relevant acceptance tests work together. Screens alone, provider sandbox responses alone, or a successful happy-path transaction alone do not establish completion.

---

## 2. Product purpose, outcomes and scope

### 2.1 Product definition

Zetmond lets verified customers hold USDT, receive supported external USDT transfers, send USDT externally and trade USDT against supported local currencies. A country-based currency estimate helps users understand their USDT value; it is not a spendable fiat wallet.

The Vault collects both sides of an accepted P2P trade: the seller's USDT and the buyer's fiat. It verifies the required amounts and coordinates delivery to the buyer's Zetmond wallet and the seller's verified local bank account. Neither party manually authorizes release after the required funding conditions are satisfied.

### 2.2 User outcomes

- A customer can understand what they own, what is available and what is held.
- Both traders know the principal, their fee, their exact deposit and their expected receipt before paying.
- Either trader can fund first and see a reliable funding deadline.
- A customer can distinguish received, pending, under review, paid out and refunded funds.
- A customer can complete the same core tasks on a phone or desktop.
- Operations can investigate and recover incomplete obligations without duplicating money movement.

### 2.3 Production scope

| Included area | Required deliverable |
|---|---|
| Accounts | Registration, login, recovery, country capture, contact binding and approved security controls |
| Identity | Real KYC integration/process, status, correction and server-enforced eligibility |
| Wallet | Custodial USDT balances, supported external deposits/withdrawals, holds and receipts |
| P2P | Fixed-rate offers, eligibility checks, order acceptance and immutable invoices |
| Vault | Both deposit routes, exact amount checks, persistent timers and verified settlement |
| Recovery | Payment review, cancellation, late funds, payout recovery and refunds |
| Advertisers | Eligibility, applications, approved categories, collateral and offer management |
| Account services | Banks, security, settings, notifications, help and support cases |
| Operations | Separate admin access, review queues, reconciliation, evidence and audit history |
| Responsive UI | Complete customer workflows on desktop, tablet and phone; usable admin workflows across these sizes |
| Service operation | Monitoring, incident response, backup/restore, secure delivery and provider reconciliation |

Scope may be phased only through an explicit owner decision. Unavailable capabilities must not be advertised as available or replaced with simulated success.

### 2.4 Outside the approved scope

- Native iOS/Android apps, offline transaction execution or an installable PWA commitment.
- Assets other than USDT; fiat wallet balances; self-custody recovery phrases.
- Staking, lending, leverage, swaps, cards, referral programmes or business accounts.
- Negotiated-price trading, public user-to-user chat or ratings unless separately approved.
- A multi-role admin permission hierarchy.
- Rebuilding the completed marketing site, except separately approved integration/copy updates.

---

## 3. Confirmed business rules

These rules carry forward from the main PRD unless specifically superseded above.

| Rule ID | Rule |
|---|---|
| BR-01 | Product name is **Zetmond**. |
| BR-02 | Holdings are USDT only; local fiat is a display estimate, not a wallet balance. |
| BR-03 | Registration country determines the displayed local currency. Country eligibility and settlement-market eligibility are separate. |
| BR-04 | Zetmond uses a custodial model; customers do not manage wallet private keys. |
| BR-05 | Supported external USDT deposits and withdrawals are included. External receipt charges are intended, but the fee schedule is unresolved. |
| BR-06 | Seller P2P crypto funding and buyer P2P crypto receipt use Zetmond wallets. |
| BR-07 | Buyer fiat is paid to the Vault collection account; seller fiat is paid to the seller's verified bank destination. |
| BR-08 | The Vault provides a crypto funding destination and a unique trade-linked fiat account. Allocation mechanics are unresolved. |
| BR-09 | Advertisers publish fixed rates; an accepted order keeps its original rate. |
| BR-10 | Both parties pay a 0.5% platform fee, added to their respective deposits. |
| BR-11 | Each invoice shows the platform fee before payment, in the actual asset/currency. |
| BR-12 | Cancelled trades retain no platform fee; any deposited platform-fee component is returned. |
| BR-13 | Bank charges are separate. The buyer's bank refund charge is deducted from the buyer's refund. |
| BR-14 | Neither party funded: 20-minute window after the agreement becomes active. |
| BR-15 | First qualifying payment: replace that deadline with a fresh 15-minute window for the other party. |
| BR-16 | After either party pays, users cannot cancel the trade. Pending/uncertain payments at expiry enter review. |
| BR-17 | Incorrect fiat amount, whether too low or too high, cancels the trade and triggers the applicable returns. |
| BR-18 | An incorrect in-app seller USDT amount is blocked and the exact required amount is shown. |
| BR-19 | Approved KYC is required before wallet or trading use. |
| BR-20 | Advertisers require verified identity, phone, email, bank-name match and the applicable security deposit. |
| BR-21 | Advertiser categories: General—Beginner, Regular, Veteran; Verified—Bronze, Silver, Gold; Block as a separate category. Numeric criteria remain open. |
| BR-22 | Marketing, customer app and admin portal remain separate surfaces. Customers and admins share one login page; backend role checks route accounts and protect admin operations. Admin has one initial role and no public signup. |
| BR-23 | Delivery is responsive web for desktop, tablets and phones. Preserve the existing purple identity and overall customer-app structure. |
| BR-24 | The current build targets real users and real transactions. No target launch date is agreed. |

---

## 4. Users, access and account states

### 4.1 Permission model

Buyer and seller describe participation in a particular trade. Advertiser status, KYC status and admin privileges are separate attributes.

| Actor/state | Allowed experience | Restricted operations |
|---|---|---|
| Visitor | Public information, approved policies, sign-up/login entry | Private account data and all financial actions |
| Registered, verification incomplete | Complete onboarding, see status, request support and recover access | Wallet use, deposits enabled through the UI, withdrawals and P2P |
| KYC pending/correction required | Review submitted status and permitted corrections | Financial actions remain unavailable |
| Verified eligible customer | Wallet and supported market participation within approved limits | Unsupported markets/networks and advertiser-only functions |
| Approved advertiser | Eligible customer actions plus approved offer/advertiser features | Admin operations; manual release of counterpart funds |
| Restricted customer | Access and operations according to the approved restriction policy | Do not assume blanket confiscation, unrestricted withdrawal or universal lockout |
| Admin | Approved operational actions through the separate portal | No unlogged balance editing or bypass of required payment evidence |

**Required safeguards:** Every API enforces authentication, actor permissions, object ownership, current KYC/eligibility and relevant account restrictions. Hiding a button or using a separate admin URL is insufficient.

### 4.2 Account state changes

The system must distinguish registration, contact verification, KYC and restriction states. A status update must propagate to all open sessions. Recheck eligibility when executing a financial action, not only when the page loads.

If KYC approval is revoked or an account becomes restricted while an order is active, preserve the order, money and obligations. Apply an approved exception policy; do not silently cancel or release funds. That policy is part of O19/O21/O24.

### 4.3 Ownership of sensitive destinations

- A bank destination must belong to the authenticated customer under the approved name-verification policy.
- P2P buyer credit uses the buyer's internal Zetmond wallet identity.
- Payout and refund destinations cannot be substituted through client-provided IDs without authorization.
- Accepted orders retain protected destination snapshots. Editing profile banks does not reroute an existing trade.

---

## 5. Product surfaces and information architecture

### 5.1 Public marketing site

Keep its distinct layout. Entry links must lead to the correct customer registration/login paths. Admin login must not be presented as customer registration. Supported-market, fee and security claims must match actual enabled capabilities and approved disclosures.

Terms, privacy, fee and Vault-policy pages must contain approved content before live onboarding. Placeholder legal pages cannot serve as production terms.

### 5.2 Customer navigation

Retain the seven primary sections in this order:

1. Overview.
2. P2P Market.
3. Vault.
4. Activity.
5. Security.
6. Settings.
7. Support.

Advertiser tools sit inside P2P. Notifications open from the bell. Wallet Receive/Send flows are reachable from Overview. Subflows do not all become permanent navigation items.

### 5.3 Admin navigation

Proposed operational groups: Dashboard, Users, Verification, Advertisers, Trades, Payments, Refunds, Payment review/Reconciliation, Support, Fees, Configuration and Audit. Admin account security remains separately reachable.

There is one admin role. Named individual accounts, audit attribution and action-specific checks are still required; one role does not imply one shared credential or unrestricted powers.

### 5.4 Routing and navigation behaviour

- Routes and deep links identify records without exposing secret tokens or bank details in URLs.
- A page reload restores authorized server state and the current workflow step.
- Browser Back returns to an understandable state and never resubmits a financial request.
- Opening a record in two tabs or devices displays the same canonical state.
- Customer and admin sessions must be distinguishable; an ordinary customer session grants no admin access.
- Route names in this document are logical screens, not a mandated URL/file layout.

---

## 6. Responsive design and accessibility

### 6.1 Visual identity

**Owner approval O27:** the proposed purple tokens, mobile drawer, stacked cards and responsive breakpoints below are approved as the implementation baseline. Accessibility safeguards remain mandatory.

**Confirmed:** dark-purple navigation, purple primary buttons/gradients, pale lavender canvas, white rounded cards, a slim header, serif display headings and sans-serif interface text. Preserve the established structure.

**Proposed implementation tokens:** these are reconstructed from the design preview, not certified original source values. Review against the owner's approved assets before design sign-off.

| Token | Proposed value/use |
|---|---|
| Primary purple | `#6837FF` — primary actions and active controls |
| Deep purple | `#28163F` — sidebar and dark gradient areas |
| Text | `#2E2143` — headings and primary labels |
| Page canvas | `#F7F5FB` — lavender background |
| Card surface | `#FFFFFF` |
| Subtle border | `#EEE9F6` |
| Secondary text | Select an accessible tone against each surface; do not preserve low contrast merely to match a mockup |
| Display font | Existing approved serif; Georgia is a proposed fallback |
| Interface font | Approved sans serif; system sans stack is a proposed fallback |
| Spacing | Proposed 4px base, predominantly 8/12/16/24/32px intervals |
| Card corners | Proposed 16–20px, consistent within a component family |

Status colours require accompanying labels/icons. Success, warning and error shades must pass contrast checks on the actual surface.

### 6.2 Layout bands — proposed baseline

These are design/QA bands, not device detection rules. Layout should adapt to available space and text size.

| Viewport width | Navigation | Content layout | Typical checks |
|---|---|---|---|
| 320–767 CSS px | Header menu opens an overlay drawer | One column; stacked cards and readable form steps | 320, 360, 390 and 430px |
| 768–1023 CSS px | Drawer or compact navigation when content would otherwise be squeezed | One or two columns according to content | 768 and 820px, portrait and landscape |
| 1024–1439 CSS px | Persistent left sidebar | Main working column plus optional summary panel | 1024 and 1280px |
| 1440 CSS px and above | Persistent sidebar | Bounded content width; avoid excessively long text lines | 1440 and 1920px |

Proposed desktop shell: approximately 224–240px sidebar, 64–80px header, 24–32px content gutters. Proposed phone shell: 16px gutters, compact header, full-width form actions. Exact dimensions remain reviewable under O27.

### 6.3 Desktop requirements

- Sidebar keeps the active section evident; secondary screens show a useful title/back path.
- Marketplace, activity and operational records may use accessible tables.
- Trade invoice and Vault pages can use a primary work area with a persistent order summary.
- A secondary summary must never obscure the main form or change financial values independently.
- Dialogs remain within the viewport, support keyboard dismissal where safe and return focus to the trigger.
- Long records paginate or load incrementally without hiding active filters or losing the user's position.

### 6.4 Mobile requirements

- Use the same seven sections in a drawer. No new bottom-tab structure is approved by this document.
- Drawer supports open/close, Escape, focus containment, a labelled close control and return of focus. Background content is unavailable to assistive technology while the drawer is modal.
- Marketplace rows become stacked offer cards. Price, limit, available amount, advertiser identity and Buy/Sell action remain visible together.
- Activity and trade lists become compact record cards; essential amount/status/action must not require horizontal scrolling.
- Forms remain single-column. Appropriate keyboards and input modes must not reject valid address characters or local names.
- Amounts, fee totals, account number and timer wrap or resize without truncating significant digits.
- Long wallet addresses have a readable wrapping layout, explicit copy action and full review access; ellipsis alone is insufficient for authorizing a transfer.
- A sticky primary action is allowed only when it does not cover content, error text, the software keyboard, cookie notices or device safe areas.
- Vault funding instructions place the exact amount, deadline, destination and current payment status before secondary explanation.
- Bank-app switching, background tabs and browser suspension must not reset a deadline or discard a received-payment update.
- Clipboard failures have a selectable-text fallback. “Copied” appears only after a successful copy.
- Camera/file capture is requested only at the relevant KYC/evidence step. A permission-denied state provides a permitted alternative.

### 6.5 Tablet requirements

Tablet is a separate QA target, not a scaled screenshot. Avoid a permanently wide sidebar when it forces dense financial forms into narrow columns. Use an order summary beside the work area only when both remain readable. Test touch and external keyboard input.

### 6.6 Accessibility target — proposed baseline

Target WCAG 2.2 AA, approved under O28; verify compliance before release. W3C's reflow criterion covers content at 320 CSS pixels with defined exceptions; its minimum target-size criterion is 24 by 24 CSS pixels with exceptions. Zetmond's proposed design target is larger, 44 by 44px for primary touch controls. This larger target is a product design choice, not the AA minimum. [R3]

Additional acceptance expectations:

- All tasks work with a keyboard and visible focus.
- Fields have persistent labels, instructions and associated errors; colour is not the only error indication.
- Use semantic headings, buttons, links and table headers.
- Status updates are announced without repeatedly reading a countdown every second.
- Modal focus is managed; sticky UI does not hide focus.
- Text can be enlarged and layouts can reflow; respect reduced-motion settings.
- Authentication supports accessible input and permitted password-manager/paste workflows.
- Any exception to timing-adjustment accessibility criteria for trade deadlines must be justified and reviewed; do not assume all timers are automatically exempt.

### 6.7 Shared component requirements

| Component | Required states |
|---|---|
| Button | Default, hover where available, focus, loading, disabled with explanation, success/failure result |
| Amount field | Empty, valid, precision/limit error, insufficient funds, stale quote |
| Form field | Label, help, required indicator, error, read-only, disabled where justified |
| Status badge | Text plus colour/icon; no ambiguous “success” for pending money |
| Balance card | Loading, verified balance, stale data, hidden/privacy mode if approved, fetch failure |
| Account/address card | Asset/network or bank/currency, source, reference, copy success/failure |
| Timer | Active deadline, updating/checking, expired pending verification; server-derived |
| Invoice | Quote, expired/repriced quote, accepted immutable terms, invalid eligibility |
| Table/card list | Loading, populated, empty, filtered-empty, partial error, pagination |
| Receipt | Processing record, completed movement, refund, later exception annotation |

Production screens must not contain “All 95 screens,” “UI review,” sample-data controls, role switchers, time accelerators or fake approval buttons.

---
## 7. Onboarding, authentication and KYC

### 7.1 Registration and country setup

**Confirmed:** capture registration country; map it to the local display currency; complete KYC before financial use.

**Required safeguards:**

- Validate eligibility and supported registration countries on the server.
- Distinguish account country, display currency and available settlement markets in the data model.
- Do not infer registration country exclusively from IP address, phone prefix or browser location.
- Record the accepted policy version and acceptance evidence under the approved legal process.
- Make duplicate-account and invalid-input handling understandable without leaking private account existence.
- Prevent automated registration abuse and verification-code abuse under an approved rate policy.
- Resume incomplete onboarding after authorized login; never persist password/OTP plaintext as a form draft.

**Decisions required:** registration fields, minimum age/eligibility, ordinary customer contact requirements, provider/document rules and permitted country changes: O01/O05/O19/O22.

### 7.2 Email and phone verification

Advertisers must have both verified contacts. Under O22, ordinary customers must also verify both email and phone before financial access. Provide verification, resend, invalid/expired code, delivery failure and change-contact flows as required by the chosen policy.

Codes must be server-issued, purpose-bound, time-limited, resistant to guessing and single-use where applicable. Exact lifetimes, attempt limits and delivery providers require configuration approval. A customer cannot set a verified flag through a browser request.

### 7.3 Login, sessions and recovery

- Authenticate against the selected identity service/backend; production login must not accept arbitrary credentials.
- Show secure recovery entry points with non-revealing responses.
- Resolve the approved MFA policy before enabling sensitive operations. Proposed minimum: mandatory MFA for administrators and step-up verification for withdrawals and destination/security changes; this is a recommendation awaiting O20/O21.
- Display active sessions with a meaningful device/time description and a revoke action where supported.
- Session expiry interrupts uncommitted actions safely. After login, recover the transaction's server status before offering another submission.
- Recovery must not bypass identity/security controls or automatically unlock held funds.
- Password/contact/MFA changes invalidate or re-evaluate affected sessions according to the approved policy and trigger appropriate security notices.

O20 approves a 12-character password minimum and the security baseline in Section 23. Exact OTP lifetimes, recovery procedures, session timeouts and lockout values remain TBD.

### 7.4 KYC submission and review

Required flow: eligibility check → permitted identity details → approved evidence/capture → submission → review → approval or actionable correction/rejection.

| State | Customer UI | Backend/operations consequence |
|---|---|---|
| Not started | Explain requirement; start verification | Financial access unavailable |
| Draft/incomplete | Resume permitted fields | No fabricated provider submission |
| Uploading/submitting | Progress and safe retry/status recovery | Deduplicate submissions and protect uploaded objects |
| Under review | Status, reference and approved expectation | No approval based on frontend changes |
| Approved | Confirmation and enabled eligible features | Persist verified outcome and evidence reference |
| Correction required | Permitted reason and resubmission action | Keep prior decision history |
| Rejected/restricted | Approved explanation and support/appeal route | Apply the policy without exposing internal detection rules |
| Provider unavailable | Clear pending/unavailable state | No fail-open approval |

KYC evidence must be access-controlled, encrypted and retained under the approved policy. Prefer provider-hosted capture or minimum necessary local storage where it meets the chosen integration and privacy requirements. Final capture methods are a provider/design decision.

**Desktop/mobile:** desktop may use a step panel plus guidance; mobile uses one step per screen with upload/camera alternatives. Preserve entered non-secret data across recoverable errors. Do not require a desktop to complete approved onboarding.

### 7.5 Onboarding acceptance

A not-yet-approved user cannot receive enabled wallet funding instructions, initiate a withdrawal, publish an offer or create a trade through either UI or direct API requests. If unsolicited funds arrive at a previously issued address or existing account becomes restricted, record the receipt and apply the approved custody/review policy; never discard the financial event.

---

## 8. Wallet overview, deposits and withdrawals

### 8.1 Overview and balances

The overview contains:

- USDT available balance.
- USDT held for trades, separate from advertiser collateral.
- A clearly labelled local-currency estimate and its freshness.
- Receive, Send, P2P and Activity entry points.
- Recent real account activity.
- Active trade summary, with status and link.
- Any KYC, security or service condition that blocks the next action.

**Required safeguard:** balances come from durable financial records. The UI must not derive spendable money from a cached number or optimistic animation. Holds, releases and completed movements must be consistent across devices.

A total-balance definition must be explicit. Proposed display: `available + trade-held + advertiser-held`, with pending uncredited deposits excluded and shown separately. The ledger team must document the final account mapping so amounts are not counted twice.

The local estimate must identify which USDT quantity it values. A stale or unavailable rate must not be shown as a fresh quote. The accepted P2P rate remains independent of this estimate.

**Desktop:** balance hero, summary cards, recent activity and active trade panels. **Mobile:** balance hero, compact held-funds summary, quick actions, active trade and recent activity stacked in priority order.

### 8.2 Receive USDT

1. Verify account eligibility and supported receive capability.
2. Select an enabled USDT network, if more than one is supported.
3. Display the address, network, asset, applicable memo/tag where required and approved fee disclosure.
4. Provide copy and QR representation of the actual supported destination format.
5. Explain the supported-network restriction in plain language.
6. Track detected deposits through verification/confirmation to ledger credit.
7. Show gross receipt, any approved charge and net credited USDT in the detail record.

Do not substitute a random address, derive an address in the browser or present the old screenshot's TRC-20 label as an approved network. Charge handling for very small receipts, unsupported assets/networks, reorgs and incorrect destinations needs O02/O03/O04/O17/O18.

**States:** address provisioning, address available, provisioning failed, deposit detected, confirming, credited, under review, rejected/unsupported where reliably identified. Confirmation thresholds and event finality are network-specific and unresolved.

**Mobile:** address and network appear above the fold where practical, with large copy controls. QR is supplementary; it must not be the only way to obtain the address.

### 8.3 Send USDT externally

1. Verify KYC, restrictions, available funds, network and transaction limits.
2. Enter destination and amount using server-validated rules for the selected network.
3. Obtain a time-bounded authoritative quote with amount sent, platform fee, network fee, total debit, expected recipient amount and fee asset.
4. Display a review screen that allows the full address to be checked.
5. Apply the approved transaction authorization/step-up process.
6. Commit the authorized request, reserve the needed balance and submit through the custody integration.
7. Show a stable transaction reference and recover status if the browser or network disconnects.
8. Display completion only after the configured verified result.

Changing the recipient, amount, network or material fee terms invalidates the previous confirmation and authorization. An expired quote requires review of a fresh quote.

A provider timeout is an unknown outcome until checked. The UI must say that the transfer is being checked; it must not offer an unqualified retry that can create a second transfer.

**Required states:** invalid destination, unsupported network, precision/min/max violation, insufficient funds including fees, quote expired, authorization failed, submitting, queued, broadcast/submitted, confirming, complete, failed, under review.

**Desktop/mobile:** same information and authorization. Desktop can use form + summary; mobile uses entry → review → authorization → result. Do not hide fees in a collapsed section required to understand the total debit.

### 8.4 Wallet concurrency

The system must atomically prevent spending funds already held by another withdrawal, trade or advertiser deposit. Two tabs, repeated clicks and simultaneous API calls cannot spend the same available amount. A failed outgoing attempt releases a reservation only after the system knows no corresponding external transfer can still complete.

### 8.5 Wallet completion criteria

Live network/custody integration, actual balance updates, approved fee quotes, address validation, secure authorization, recovery of unknown outcomes and reconciliation are required. Local-storage balances, generated sample hashes and success after a timer are unacceptable production substitutes.

---

## 9. Marketplace and advertiser centre

### 9.1 Marketplace browsing

Both Buy USDT and Sell USDT views must show:

- Advertiser identity/display name permitted by policy.
- Approved category/level, clearly distinct from identity verification.
- Fixed price with settlement currency and price unit.
- Available quantity and minimum/maximum order size.
- Supported Vault settlement method.
- Eligibility/unavailability state and correct Buy/Sell action from the viewer's perspective.

Proposed filters: supported settlement currency, amount and advertiser category. Sorting/ranking, historical metrics, reviews and user chat remain O23. Never fill missing real metrics with fictional trade counts or completion percentages.

**Desktop:** table/list with filters and row actions. **Mobile:** stacked offer cards; filters open as an accessible sheet or dedicated screen. Price, limits and action remain on the same card.

### 9.2 Offer selection and quote

- Show complete offer terms before the order is accepted.
- Validate user eligibility, network/market availability, self-trading restrictions under the approved policy, quantities and the current offer version.
- Recheck offer availability at commitment; the first user's open page does not prove inventory remains available.
- If terms change before acceptance, show the changed terms and require a fresh review.
- Once accepted, rate, principals, fees, destinations and rule versions are immutable.
- Prevent duplicate order creation from repeated submissions.

How liquidity is reserved before/after acceptance, whether a seller's funds are already reserved by an offer and when unused reservations release must be settled under O23/O03. Implementation must distinguish an offer reservation from actual Vault funding so it does not start the 15-minute clock prematurely.

### 9.3 Advertiser eligibility and application

Required eligibility components: approved KYC, verified email, verified phone, bank-name match and configured security deposit. Show fulfilled, missing, pending and failed checks separately.

Application records include requested category, evidence references, submitted rule version, review result, reason, timestamps and actor. Approvals cannot be created by toggling a client flag. Do not seed fake production advertisers or silently waive deposits to create initial liquidity.

### 9.4 Categories and collateral

| Category | Levels | Still needs approval |
|---|---|---|
| General | Beginner, Regular, Veteran | Deposits, eligibility thresholds, benefits and limits |
| Verified | Bronze, Silver, Gold | Additional qualification, review, benefits, deposits and downgrade rules |
| Block | Separate category | Eligible customers, large-order boundaries, evidence, collateral and risk limits |

Security deposits are distinct from trading principal and platform fees. UI and records must distinguish required, pending, locked, release requested, releasing, released and reviewed amounts as applicable. Deposit deductions/forfeiture, exit conditions and release authority require O08/O09; no deduction power is implied.

Bybit was an inspiration for the category structure. Its current fees, deposits or vendor thresholds are not automatically Zetmond policy.

### 9.5 Offer management

Advertisers can create, view, edit, pause/resume and close eligible offers under approved rules. Creation requires direction, supported fiat market, fixed rate, available quantity and min/max order sizes. Validate all inputs on the server and reject inconsistent limits.

Edits apply to future orders. Pausing an offer stops new order acceptance but does not erase existing trades or outstanding obligations. Explain the distinction before confirmation. Concurrent edits use a version check to prevent overwriting a newer change.

**Desktop:** offers table, category summary and application/collateral panels. **Mobile:** offer cards, full-page editor and clear status chips. Sensitive collateral actions use a dedicated review step, not a small unlabelled row icon.

---

## 10. Agreement, receiving accounts and invoices

### 10.1 Agreement record

The accepted trade must preserve:

- Order ID, participants and buyer/seller assignments.
- USDT quantity, fiat currency and fixed rate.
- Principal and each platform-fee amount.
- Exact deposit for each participant, with approved rounding.
- Separately approved bank charges and payer allocation.
- Buyer Zetmond wallet and seller bank destination snapshots.
- Funding windows, cancellation/refund policy version and fee/rule versions.
- Acceptance evidence for both parties under the selected acceptance model.
- Creation/activation timestamps, quote/offer version and subsequent financial references.

Acceptance by publishing an offer versus explicit acceptance per order remains O10. Do not start the 20-minute deadline while displaying “waiting for the other party” unless that matches the finally approved activation rule.

### 10.2 Receiving accounts

**Buyer:** confirm the authenticated buyer's Zetmond wallet. External P2P receipt is not allowed; the separate external withdrawal flow remains available after eligible credit.

**Seller:** select a verified bank account in a supported market/currency. Show masked details for selection and full necessary payout confirmation under authenticated access. Name-match failure blocks activation unless an approved resolution path verifies ownership.

Once funding begins, do not permit self-service destination replacement. A correction process must preserve the original snapshot, reverify authorization and remain auditable; financial impact must follow an approved policy.

### 10.3 Fee calculations

Let `Q` be USDT principal, `R` be fiat units per USDT and `f = 0.005`.

| Item | Formula before approved rounding |
|---|---|
| Fiat principal | `P = Q × R` |
| Seller platform fee | `Fs = Q × f` USDT |
| Seller Vault deposit | `Ds = Q + Fs` USDT |
| Buyer platform fee | `Fb = P × f` fiat |
| Buyer Vault deposit | `Db = P + Fb` fiat |
| Buyer principal entitlement | `Q` USDT |
| Seller principal entitlement | `P` fiat |

**Illustrative arithmetic fixture, not a market quote:**

| Participant | Principal supplied | Platform fee | Deposit before separate bank charges | Principal received |
|---|---:|---:|---:|---:|
| Seller | 100 USDT | 0.50 USDT | 100.50 USDT | ₦130,000 |
| Buyer | ₦130,000 | ₦650 | ₦130,650 | 100 USDT |

Fixture rate: ₦1,300 per USDT. Successful bank-charge allocation remains O15. Do not promise the seller a net bank receipt or add a bank charge to the buyer's deposit until the allocation and provider quote are approved.

### 10.4 Precision and immutable amounts

**Required safeguard:** use exact decimal arithmetic or integer asset units, never binary floating-point values for payable amounts. Persist asset/currency scale and the calculation/rule version. The backend is the source of truth for invoice totals; frontend calculations are provisional display assistance only.

O16 must specify rate precision, quantity precision, fee rounding mode, the sequence of rounding operations, fiat minor units, minimum order/fee, any taxes and handling below representable precision. No tolerance band for a wrong fiat amount is approved.

### 10.5 Invoice presentation

Both layouts show the principal, fee percentage, fee amount, exact deposit, expected principal receipt, approved other charges, receiving destination, deadlines and cancellation/refund rules before acceptance.

**Desktop:** invoice beside a trade summary and explanation panel. **Mobile:** vertically ordered invoice; prominent exact total; a deliberate final acceptance control. A checkbox must not be preselected. Any required disclosures must be readable before the primary action becomes available.

An invoice is a request/record of agreed payment terms, not a receipt. Versioned invoices and receipts must remain downloadable/viewable from the authenticated record without exposing other customers' information.

---

## 11. Vault funding and deadlines

### 11.1 Funding workspace

The buyer and seller see one shared trade with role-specific payment instructions. Both can fund first.

| Viewer | Main payment instruction | Counterparty information |
|---|---|---|
| Seller | Exact USDT including 0.5% fee; Zetmond-only funding source and Vault destination/reference | Whether buyer fiat is awaiting, received, being checked or verified |
| Buyer | Exact fiat including 0.5% fee; unique Vault bank account, beneficiary, reference and approved expiry | Whether seller USDT is awaiting, funded or under review |

The buyer does not pay the seller's bank directly. A seller's payout account must not be presented as the Vault collection account.

Already-funded participants see “Your deposit is received” and the next status. Do not leave an active duplicate-funding control on their screen.

### 11.2 Seller funding validation

- Retrieve the exact required deposit from the immutable invoice.
- Check Zetmond ownership, eligible account status and available balance.
- Block wrong amounts in the UI with a message such as “Send exactly 100.50 USDT.”
- Repeat the same exact validation and balance reservation atomically on the backend.
- On success, record a unique funding movement and update both participants' view.
- On unknown outcome, recover the existing request status before any repeat action.

Whether a Vault destination is a real blockchain address, an internal ledger destination with address-like presentation, or a combined mechanism is O03. The UI must use truthful labels. Do not imply a confirmed on-chain transfer where only an internal hold exists.

### 11.3 Buyer fiat verification

The backend must verify provider authenticity and the actual transaction against currency, amount, account, reference, source, permitted sender and financial status. Save gross amount received separately from provider charges/net settlement.

A signed notification alone is not sufficient if its transaction data cannot be matched or verified according to the provider contract. The payment event may require an independent transaction lookup. Screenshots and “I paid” claims may open a support case but cannot mark the invoice paid or release funds.

### 11.4 Server-authoritative timers

| Stage | Deadline |
|---|---|
| Both parties have accepted; neither funded | Activation time + 20 minutes |
| First qualifying payment recorded | Qualifying first-payment time + 15 minutes |
| Both correct deposits qualify | Funding countdown ceases; settlement status takes over |
| Expiry with pending/uncertain evidence | Payment review; no premature return or release |

If first funding occurs at minute 19, the second window ends at minute 34. Repeat events do not start another 15 minutes. An incorrect fiat payment initiates the mismatch outcome; it does not grant a new ordinary trading window.

**Decision O11:** define the trusted payment event, whether timestamp means receipt or confirmation, exact-boundary inclusivity, provider time trust, delayed webhooks and grace/review rules. These choices must be documented and tested before money movement is enabled.

**Required safeguards:**

- Persist deadlines and qualifying-event evidence on the backend.
- Use a durable expiry process that survives worker restart and catches up after downtime.
- Process the expiry decision and deposit evidence with concurrency control.
- Enforce one authoritative settlement-or-return decision per obligation.
- Browser clock changes, tab suspension, page refresh and notification failure cannot extend the deadline.
- The interface renders a server-provided deadline with freshness metadata. On uncertain connectivity, show “Checking payment status” and reconcile before another action.
- Define provider/account provisioning failure handling before starting an active funding window; do not consume a customer's usable payment time because required instructions failed to provision. Final allocation/start semantics require O07/O10.

### 11.5 Vault desktop/mobile layout

**Desktop:** primary progress timeline and funding card; adjacent immutable trade summary, destinations and issue entry.

**Mobile:** trade/reference → role and current state → remaining time → exact required payment and destination → both deposits → both payouts → summary/policies. Funding instructions cannot depend on a desktop-only side panel. Long bank details and fees remain selectable/readable.

A countdown is information, not proof that a transfer has failed. At zero, replace the payment action with a server-verified status. Never offer a client-side “extend time” control without a separately approved policy.

---
## 12. Settlement, cancellation and refunds

### 12.1 Settlement eligibility

Before initiating settlement, the backend must establish that:

1. The accepted order and destinations are valid and immutable.
2. Both exact deposits are verified under the approved finality rules.
3. The order is eligible under the approved deadline policy.
4. No conflicting cancellation, refund decision or unresolved financial hold exists.
5. Both payout obligations can be created/recovered with stable unique identities.

Eligibility does not mean both payouts have already completed. The system must record the settlement decision before dispatching durable work so a restart can resume it.

### 12.2 Two distinct obligations

| Obligation | Recipient | Completion evidence |
|---|---|---|
| Buyer crypto credit | Buyer's Zetmond wallet | Committed, reconciled ledger credit of the agreed USDT principal under the custody model |
| Seller fiat payout | Seller's verified bank snapshot | Verified provider result meeting the agreed bank-payout completion definition |

Each has its own ID, amount, asset/currency, destination, attempts, provider references and status. An accepted API request is not automatically completion evidence.

The trade becomes **Completed** only when both obligations are fulfilled. O18 approves seller fiat payout first, followed by buyer USDT credit after verified fiat success. Prefunding/liquidity requirements, numeric retry limits and post-settlement reversal liability remain TBD. The UI must not describe separate bank and crypto systems as an atomic simultaneous transfer.

### 12.3 Partial settlement and recovery

If buyer USDT credit succeeds and seller fiat payout fails:

- Preserve the successful crypto credit.
- Keep the seller's payout obligation outstanding.
- Show the real state to both participants, with role-appropriate detail.
- Route the outstanding obligation to operational recovery.
- Check the previous external attempt's status before a retry.
- Never credit the buyer again or refund the original seller deposit as an ordinary cancelled trade.

Under O18 the seller fiat payout is confirmed first, then buyer USDT credit is committed. If fiat succeeds but crypto credit fails, preserve the payout and recover only the outstanding crypto obligation. If a completed bank movement is later reversed, create a linked exception and preserve the historical record. Recovery/compensation authority and customer liability must be decided before launch.

### 12.4 Incorrect fiat amount

For a verified ordinary single payment below or above the exact invoice amount:

1. Stop settlement and record mismatch evidence.
2. Cancel the trade with the appropriate reason.
3. Return the actual fiat received to the verified original source, less the applicable bank refund charge.
4. Return any seller USDT already funded, including its platform-fee component.
5. Track both returns independently until completed.

Do not ask the buyer to top up, silently keep an overpayment or settle a revised smaller order. A bank/provider fee deducted after receipt is not proof that the buyer sent an incorrect amount; reconcile the gross amount and charge records.

Split payments, multiple independent payments, duplicate webhooks versus duplicate money, third-party sources and unknown source accounts require O12/O14. These must not be handled by an invented tolerance or by summing receipts until a preferred outcome appears.

### 12.5 Cancellation outcomes

| Situation | Required outcome |
|---|---|
| No funds at the 20-minute deadline | Expire/cancel with zero platform fee and no fabricated refund |
| Seller alone funded; second window expired; no pending counterpart payment | Cancel and return seller's funded USDT including fee |
| Buyer alone funded; second window expired; no pending counterpart payment | Cancel and return buyer's received fiat including fee component, less bank refund charge |
| Pending/uncertain payment at expiry | Payment review until evidence supports an approved outcome |
| User requests cancellation after either pays | Reject on the server; no customer cancel action |
| User requests cancellation before any payment | Allowed under O13 only after atomic server verification that neither side has paid and no payment is pending |
| Funds arrive for an already cancelled order | Record and associate late funds; return/review under policy, never silently reactivate the order |
| One settlement obligation is already fulfilled | Settlement recovery; ordinary pre-settlement cancellation is not valid |

Cancellation of the trade and completion of its refunds are separate facts. “Cancelled — refund processing” is valid; “Refunded” without confirmed return evidence is not.

### 12.6 Refund amounts and presentation

Ordinary buyer fiat refund:

`Net refund = actual fiat received − actual applicable bank refund charge`

Retained platform fee on a cancelled trade: **zero**.

The detail screen must show gross receipt, returned platform-fee component where applicable, bank refund charge, net return, masked original destination, reason, reference, status and last update. An unknown bank charge must not become an invented amount or a completed refund claim.

Handling a bank charge equal to or greater than the received amount is O17. Do not create a negative refund, erase the liability or impose an unapproved extra charge.

Seller crypto return includes the trade-funded USDT and its deposited platform fee. Any separate non-bank return costs require explicit policy approval; none is approved here.

**Desktop:** separate buyer and seller return panels with a shared reason/timeline. **Mobile:** the viewer's return first, then counterpart status without unnecessary private details. Provide support access without inviting a second payment.

### 12.7 State model

The following names are a proposed implementation vocabulary. The confirmed outcomes remain mandatory regardless of naming.

| Trade state | Meaning | Principal next outcomes, subject to verified guards |
|---|---|---|
| Agreement pending | Final terms not fully accepted | Activate after acceptance; abandon under approved policy |
| Awaiting funding | No qualifying deposit; initial window active | One funded, review or no-funds cancellation |
| Buyer funded / Seller funded | Exactly one qualifying side; second window active | Ready to settle, review or cancellation/returns |
| Payment review | Evidence, timing, source or amount is uncertain | Evidence-based approved settlement or cancellation; no invented deadline reset |
| Ready for settlement | Both deposits qualify and settlement decision is recorded | Settling |
| Settling | One or both obligations remain in progress | Completed or settlement review |
| Settlement review | Payout failure, unknown outcome or reversal investigation | Recover outstanding obligation or explicitly authorized resolution |
| Completed | Both payout obligations fulfilled | Readable receipt; later exceptions linked separately |
| Cancelled | This order will not settle | Close if no funds; otherwise keep refund obligations active |

Separate deposit states: expected, detected/pending, verified, mismatch, review. Separate payout/refund states: created, queued, submitted, unknown, confirmed, failed/review. A state transition requires a valid cause, actor/event, amount, version and timestamp.

### 12.8 Irreversible outcome protection

A single order lock or equivalent serializable control must prevent competing handlers from both settling and returning the same liability. Event retries, deadline jobs, support actions and admin recovery must all use the same canonical transition rules. Merely checking the state in the frontend cannot prevent this race.

---

## 13. Activity, notifications, settings and support

### 13.1 Activity and receipts

Include external USDT receipts/sends, trade holds/funding, trade settlement, fees, advertiser collateral and refunds where enabled. Every item has an accurate type, amount, currency/asset, timestamp, status, reference and drill-down record.

Distinguish a hold from a completed outgoing transfer. Distinguish a released hold from a new external deposit. Prevent a user from adding a displayed fee twice when it is already part of a funding amount.

Proposed filters: type, status, date range and reference. Paginated queries must return only authorized records and remain stable when new events arrive.

Receipts must state actual status, principal, charges, net amount, destination appropriate to the viewer and reference. Pending receipts/records must not claim final completion. Downloads must be authorized at request time; an unguessable filename alone is insufficient.

**Desktop:** sortable/filterable table. **Mobile:** amount/status-led list with a filter sheet and full-page detail. Preserve equivalent filters and details.

### 13.2 Notifications

Required event categories for product review: KYC outcomes, agreement/acceptance where applicable, first funding, own deposit result, deadline warning if approved, settlement progress/completion, cancellation/refund updates, account-security events and support replies.

- Derive notifications from recorded events; deduplicate retries.
- Link to the authorized source record and recover the current state when opened.
- Keep unread/read state synchronized where supported.
- Notification delivery failure must not affect a trade's financial status or extend its timer.
- External-channel previews must not expose full sensitive amounts, bank details or identity evidence by default.
- In-app delivery is the proposed baseline; email, SMS, push, reminder timing, mandatory notices and preference rules require O24/O22.

### 13.3 Security and settings

| Area | Required behaviour |
|---|---|
| Personal details | Show editable versus verified/locked fields; legal-name changes use an approved reverification process |
| Country/currency | Show registration mapping; do not silently enable unrestricted currency/country edits |
| Banks | List ownership/verification state, add/verify, masked selection, valid destination confirmation |
| Bank removal | Prevent removal from erasing destination evidence or breaking an active obligation; final removal policy needs approval |
| Contacts | Reverify changed contacts; protect account-recovery channels against takeover |
| MFA | Setup, challenge, recovery and removal according to approved policy |
| Password | Current authorization, validation, secure update and notification |
| Sessions | Current session indicator, active sessions and authorized revocation |
| Preferences | Supported options only; critical security/legal notices obey approved policy |
| Account closure/data requests | Request/status path under approved retention and outstanding-obligation rules; no destructive instant deletion of financial history |

**Desktop:** settings groups plus a detail panel. **Mobile:** list of categories leading to full-page forms. Critical settings cannot rely on hover or tiny icons.

### 13.4 Support and disputes

Required customer flow: Help → relevant article or new case → linked order/transfer → description and permitted evidence → submission acknowledgement → case history/replies → resolution/appeal where policy permits.

- Case IDs and timestamps must persist.
- Only authorized customer and staff can access a case and attachments.
- Uploaded evidence must be checked for type, size and malicious content under approved limits.
- A support attachment cannot itself authorize payment release or replace provider evidence.
- Never request passwords, private keys, authenticator secrets or full recovery codes through support.
- Display approved service hours/targets only; no invented “instant refunds” or “24/7 response” promises.
- Customer and operational case views link to the same underlying issue while hiding internal-only notes from customers.

Evidence retention, appeals, liability, staff authority, escalation timing and support channels remain O24. Mobile supports the same case flow with keyboard-safe reply fields and permitted device uploads.

---

## 14. Admin portal and operations

### 14.1 Shared login and protected admin access

Customers and admins use one login page. The owner provisions named admin accounts in the database with hashed passwords; no public admin registration is allowed. After authentication and mandatory admin MFA, the backend checks the stored role and redirects to the appropriate portal. Admin authorization is enforced for every API and privileged session; customer sessions cannot acquire admin rights through a URL, redirect or client role field. One initial admin role and audited access remain required. See O20/O21/O26.

### 14.2 Operational capabilities

| Area | Admin needs to see/do | Required controls |
|---|---|---|
| Dashboard | Outstanding review/refund/payout queues, provider issues and reconciliation breaks | Real counts and freshness; drill-down to authoritative records |
| Users | Identity/contact/account status, linked trades and restrictions | Minimum necessary data; approved restriction authority and reason |
| KYC | Provider result, permitted evidence and correction history | Access logging, approved review process; no unconditional bypass |
| Advertisers | Eligibility, category applications, collateral and limits | Policy version and authorized decision record |
| Trades | Original invoice, participants, destinations, deposits, deadline evidence and obligations | Immutable historical terms; clearly separate lifecycle and payment states |
| Payments | Expected/gross/net/charges, provider IDs and attempt results | Verify external status before recovery |
| Refunds | Source verification, gross/charge/net, reason and progress | No arbitrary refund destination; no duplicate confirmed return |
| Reconciliation | Missing, unmatched, duplicate, reversed and inconsistent movements | Evidence trail; unresolved breaks retained until explained |
| Support | Customer messages, attachments, internal notes and linked records | Separate internal/customer visibility and recorded communication |
| Fees | Pending/refundable/earned/returned amounts by asset and currency | No cross-currency sum without approved valuation policy |
| Configuration | Approved markets, limits, fees, timing/security settings as permitted | Validated, versioned, audited; future-order effect only unless explicitly authorized |
| Audit | Actor, action, reason, request/event references and timestamps | Protected history; no self-service deletion |

### 14.3 Financial interventions

No unrestricted “edit balance,” “mark paid,” “release anyway,” “force complete” or “delete transaction” action is approved.

An authorized recovery action must identify the outstanding obligation, verify prior attempts, require an appropriate reason, enforce idempotency and preserve before/after evidence. A user-visible success state is emitted only after the underlying financial record supports it.

One role does not resolve whether high-value or exceptional actions require a second person's approval. If required by the chosen risk/provider policy, approval separation can use separately named admins of the same role. No extra role or threshold is silently introduced; decide O21.

### 14.4 Reconciliation workflow

For each enabled asset/fiat rail:

1. Obtain provider/custody statements or authoritative transaction data.
2. Match external movements to internal expected deposits, custody positions, payouts and refunds.
3. Identify unmatched external funds and internal obligations without matching external evidence.
4. Classify timing differences versus real discrepancies.
5. Assign a responsible operator, reason and resolution record.
6. Escalate unresolved breaks according to approved severity/age targets.

Do not “balance” accounts by overwriting ledger balances. Corrections require traceable approved accounting entries. Reconciliation must continue during a pause of new trades or withdrawals.

### 14.5 Admin responsive behaviour

Desktop is optimized for dense tables, filters and timelines. Mobile uses prioritized queues and detail screens with readable amounts/evidence. Financial decisions require a deliberate full-page review even on a phone. If a sensitive task cannot be implemented safely on mobile, an explicit reviewed restriction and alternative are required; silent loss of functionality is not acceptable.

---

## 15. Complete screen and state inventory

Each row is a logical product screen. Some states can share a route/component; the number of screens in the earlier preview is not a production completion metric. All listed screen families require loading, permission, empty/error and recovery states appropriate to the operation.

### 15.1 Customer access and verification

| ID | Screen | Required content/actions | Desktop | Mobile |
|---|---|---|---|---|
| UI-A01 | Registration | Approved fields, country eligibility, terms acceptance, validation | Form plus supporting copy | Single-column form; no unnecessary hero taking first-screen priority |
| UI-A02 | Email verification | Code/link, resend, expiry/error/delivery states | Focused panel | Full-width input with accessible paste |
| UI-A03 | Phone verification | Number, country code, verification, resend/status | Focused panel | Appropriate input mode; clear number confirmation |
| UI-A04 | Customer login | Credentials, recovery and approved MFA routing | Distinct customer access layout | Compact form with keyboard-safe CTA |
| UI-A05 | MFA challenge | Approved method, failure/recovery entry | Focused challenge | Paste/autofill where permitted; no hidden fields |
| UI-A06 | Forgot password | Recovery request and non-revealing acknowledgement | Focused form | Same secure flow |
| UI-A07 | Reset password/result | Valid reset session, new credential policy, result | Focused form | Keyboard and password-manager support |
| UI-A08 | Country/currency setup | Registration country and associated estimate currency | Form with explanation | Single step, supported-country search if needed |
| UI-A09 | Identity details | Approved KYC fields and privacy notice | Step form and help | One clear step at a time |
| UI-A10 | Identity evidence | Approved documents/capture, upload states | Upload/capture options | Camera/file alternatives and permission states |
| UI-A11 | Identity capture | Provider-required selfie/liveness if applicable | Supported capture guidance | Safe camera guidance and fallback policy |
| UI-A12 | Verification status | Pending, approved, correction/rejected and next step | Status panel | Compact timeline and next action |

### 15.2 Wallet and activity

| ID | Screen | Required content/actions | Desktop | Mobile |
|---|---|---|---|---|
| UI-W01 | Overview | Available/held USDT, estimate, actions, active trade and activity | Cards and working panels | Stacked priority cards |
| UI-W02 | Receive USDT | Supported network, actual address/QR, fees and copy | Address card plus instructions | Network/address before optional illustration |
| UI-W03 | Deposit status | Detected/confirming/credited/review, amount/fees/reference | Timeline and detail | Amount/status first |
| UI-W04 | Send USDT | Destination, network, amount, limits, balance | Form plus quote summary | Entry then review |
| UI-W05 | Transfer review | Full destination, fees, recipient amount, total, quote validity | Side-by-side summary | Unclipped full details before confirm |
| UI-W06 | Transfer authorization | Approved security method bound to exact transfer | Focused step | Same checks and recovery |
| UI-W07 | Transfer result | Pending/unknown/complete/failed status and next action | Result and record link | Persistent reference; safe reconnect |
| UI-W08 | Activity | Real history, filters, pagination | Table | Record cards |
| UI-W09 | Transaction detail/receipt | Actual movement, charges, references, status and download | Detail panel/route | Full-page detail and download/share capability only if approved |

### 15.3 Marketplace and advertisers

| ID | Screen | Required content/actions | Desktop | Mobile |
|---|---|---|---|---|
| UI-P01 | P2P market | Buy/Sell, supported currency, offers, limits and availability | Filterable table/list | Stacked offer cards and filter sheet |
| UI-P02 | Advertiser profile | Approved category, real metrics/definitions, active offers | Profile plus offers | Summary then offer cards |
| UI-P03 | Offer detail/amount | Fixed rate, limits, quantity, estimated invoice | Form and terms | Sequential readable entry |
| UI-P04 | Advertiser dashboard | Category, eligibility/application, own offers and collateral links | Summary and tables | Summary cards and actions |
| UI-P05 | Eligibility/application | KYC, contacts, bank match, approved deposit and application | Checklist and form | Checklist followed by next action |
| UI-P06 | Application status | Review/correction/approval/rejection and reason | Status/detail panel | Full-page status |
| UI-P07 | Tier centre | Approved General/Verified/Block rules and benefits | Comparison layout | Stacked category cards |
| UI-P08 | Advertiser collateral | Required/locked amounts, funding/release states and policy | Ledger/detail with review | Clear available versus locked distinction |
| UI-P09 | Create offer | Direction, market, fixed rate, quantity and min/max | Form plus validation summary | Single-column form |
| UI-P10 | My offers | Active/paused/closed, edit and availability | Table | Cards with labelled actions |
| UI-P11 | Edit offer | Versioned changes and future-order effect | Form/summary | Full-page editor |
| UI-P12 | Pause/close confirmation | Consequence for new orders; active orders continue | Accessible dialog or page | Sheet/page with deliberate confirm |

### 15.4 Agreement and Vault

| ID | Screen | Required content/actions | Desktop | Mobile |
|---|---|---|---|---|
| UI-V01 | Receiving accounts | Buyer's Zetmond wallet or seller's verified bank | Selection plus summary | Full-width account cards |
| UI-V02 | Invoice/acceptance | Principal, rate, fees, exact total, destinations and rules | Invoice plus order summary | Invoice stacked before acceptance |
| UI-V03 | Awaiting acceptance | If required by O10: real counterparty acceptance status | Status and terms | Status and help; no fake timer |
| UI-V04 | My Vault trades | Active, completed, review, cancelled and refund states | Filterable table | Status/amount-led cards |
| UI-V05 | Vault funding | Role-specific exact payment, deadline, both deposits | Progress + payment + summary | Deadline and own action first |
| UI-V06 | Payment review | Reason category, funds status, next update/support | Investigation summary | Readable state and safe action |
| UI-V07 | Settlement progress | Buyer crypto and seller fiat obligations separately | Two result panels | Viewer obligation first; both statuses |
| UI-V08 | Settlement recovery | Completed leg preserved; outstanding leg explained | Timeline and support | Clear pending/review state |
| UI-V09 | Completed trade receipt | Actual delivered amounts, fees, references | Receipt/detail | Full-width receipt |
| UI-V10 | Cancellation/no funds | Reason, no fee and no refund when nothing received | Result | Compact result |
| UI-V11 | Refund detail | Gross, fee return, bank charge, net, both return statuses | Two panels | Viewer return first |
| UI-V12 | Refund issue | Pending/failed/unknown return and case entry | Exception detail | Full-page recovery status |
| UI-V13 | Late-payment review | Closed order, linked late money and return status | Timeline | Status + reference + support |
| UI-V14 | Manual unfunded cancellation | Approved under O13 when neither side paid and no payment is pending; atomic server recheck | Deliberate review | Same approved rule and safeguards |

### 15.5 Account and support

| ID | Screen | Required content/actions | Desktop | Mobile |
|---|---|---|---|---|
| UI-C01 | Security overview | KYC, MFA, password, contacts and sessions | Security cards | Stacked settings rows |
| UI-C02 | MFA setup/manage/recovery | Approved enrollment and secure management | Guided form | Same security; copy/camera options as needed |
| UI-C03 | Change password | Authorized credential update and result | Form | Keyboard-safe form |
| UI-C04 | Devices/sessions | Current session, activity and revoke | List/table | Device cards |
| UI-C05 | Settings overview | Profile, country, contacts, banks, preferences and policies | Grouped sections | Category list |
| UI-C06 | Personal details | Editable/verified fields and reverification | Form | One-column form |
| UI-C07 | Country/display currency | Mapping and approved change policy | Detail/form | Same eligibility checks |
| UI-C08 | Banks | Verified/pending/failed account list | Table/cards | Cards with masked details |
| UI-C09 | Add/verify bank | Supported bank, account input, name result and authorization | Form + result | Step flow with correct input mode |
| UI-C10 | Bank verification result | Matched/pending/mismatch/unavailable | Detail | Clear next action |
| UI-C11 | Contact changes | Email/phone re-verification and security | Guided form | Step flow |
| UI-C12 | Notification preferences | Approved channels and mandatory notices | Grouped controls | Labelled touch controls |
| UI-C13 | Notifications | Read/unread and authorized record links | Panel/page | Full-page list |
| UI-C14 | Support home | Help categories, search and contact/case entry | Search and category cards | Search and stacked categories |
| UI-C15 | Help article | Approved plain-language guidance | Bounded reading column | Reflowing readable text |
| UI-C16 | New case/report trade | Reference, category, description and approved evidence | Form plus order context | File/camera where permitted; keyboard-safe form |
| UI-C17 | My cases | Own cases and current status | Table | Case cards |
| UI-C18 | Case conversation | Messages, permitted evidence, outcome/appeal | Thread + context | Thread then reply; internal notes hidden |
| UI-C19 | Account closure/data request | Policy-controlled request and status | Form/status | Same request process |
| UI-C20 | Policies | Terms, privacy, fees, Vault/refunds and version | Bounded reading layout | Readable and downloadable if supported |

### 15.6 Admin screens

| ID | Screen | Minimum production content | Responsive treatment |
|---|---|---|---|
| UI-M01 | Shared login: admin routing | Pre-provisioned admin identity, backend role check, no public admin signup | Shared desktop/mobile login; protected admin destination |
| UI-M02 | Admin security challenge | Approved mandatory controls and recovery | Accessible secure form |
| UI-M03 | Operations dashboard | Real queue counts, provider health/freshness | Desktop panels; mobile priority cards |
| UI-M04 | Users | Search/filter and permitted identity/status data | Table → cards |
| UI-M05 | User detail | Account, KYC, banks, activity and audited allowed actions | Desktop sections → mobile stacked sections |
| UI-M06 | Verification queue | Pending/correction/escalated cases | Table → queue cards |
| UI-M07 | KYC review | Provider evidence, history and approved decisions | Evidence workspace → readable detail |
| UI-M08 | Advertiser applications | Eligibility/category and review state | Table → cards |
| UI-M09 | Advertiser detail | Policy version, limits, collateral and decision history | Panels → sections |
| UI-M10 | All trades | Lifecycle, funding and obligation statuses | Filterable table → trade cards |
| UI-M11 | Trade investigation | Immutable terms, evidence, timestamps, financial legs | Timeline/detail at all sizes |
| UI-M12 | Deposits/payouts | Actual amount, source/destination, provider IDs, attempts | Table → record details |
| UI-M13 | Refund queue | Outstanding gross/net and source verification | Table → queue cards |
| UI-M14 | Refund detail | Charge quote, return evidence, recovery history | Deliberate review page |
| UI-M15 | Reconciliation/review | Unmatched/late/duplicate/reversal discrepancies | Desktop comparison; mobile focused case |
| UI-M16 | Support queue | Cases, age, category and linked records | Table → cards |
| UI-M17 | Support case | Customer/internal views and permitted responses | Thread + context → stacked layout |
| UI-M18 | Fees | Per-asset/currency pending, earned and returned records | Summary/table → cards/details |
| UI-M19 | Configuration | Approved values, effective versions and audit reason | Forms with review on all sizes |
| UI-M20 | Audit history | Actor/action/time/reason and protected evidence links | Searchable table → event cards |
| UI-M21 | Admin account security | Named account, MFA and sessions | Responsive settings |

### 15.7 Reusable exceptional states

Design and implement: initial loading; refreshing existing data; no balance; no history; no matching offers; insufficient available funds; invalid amount/precision; unsupported network/market; provider unavailable; failed upload; restricted account; session expired; forbidden record; offline/reconnecting; stale quote; expired funding window; unknown transaction result; maintenance; server error; page not found.

Every state specifies what happened, whether funds may already have moved, which actions remain safe, and how to recover. Error messages must not expose stack traces, credentials, raw provider secrets or another customer's identifiers.

---
## 16. Backend responsibilities and data requirements

### 16.1 Service boundaries

The following responsibilities are required. They may be implemented in a modular backend rather than separate microservices; no deployment topology is approved by this PRD.

| Boundary | Responsibility |
|---|---|
| Identity/access | Customer/admin authentication, sessions, permissions, contact verification and KYC gating |
| Customer profile | Country, eligibility, protected bank/contact records and preferences |
| Wallet/custody | Addresses, approved networks, transfers, confirmations and custody reconciliation |
| Ledger | Exact balances, reservations, fees, liabilities, postings and correction history |
| Marketplace | Offers, eligibility, versions, limits and allocation |
| Trade engine | Agreement, invoice snapshots, states, deadlines and settlement/return decisions |
| Fiat integration | Collection account allocation, verified receipts, payout/refund attempts and status lookup |
| KYC integration | Submission/result mapping, provider verification and review evidence |
| Operations | Review queues, reconciliation, support and authorized recovery |
| Messaging | Durable notification intents and delivery results |
| Audit/observability | Security/operational records, tracing, alerts and incident evidence |

Client applications display and request actions. They do not mint balances, determine final payment outcomes or grant roles.

### 16.2 Logical records

These are requirements for information and relationships, not a committed database schema.

| Record | Minimum required information |
|---|---|
| Customer | Stable ID, registration country, contact/KYC links, eligibility/restriction state, policy acceptances |
| Session/security factor | Owner, lifecycle, permitted device metadata, revocation and security events; no plaintext secrets |
| KYC case | Customer, provider/case ID, status, evidence references, result/reason and decision history |
| Bank account | Owner, country/currency, protected destination, verification/name-match evidence and state |
| Wallet/account | Owner, asset/network capability, custody reference and ledger account links |
| Address allocation | Owner/trade association, asset/network, address/tag, allocation/lifecycle evidence |
| Ledger transaction | Business reference, asset/currency, balanced entries, type, idempotency key and immutable timestamp |
| Reservation/hold | Owner, purpose, source amount, linked order/request, lifecycle and release evidence |
| Advertiser profile/application | Category/level, policy version, checks, approval history, limits and collateral linkage |
| Offer | Advertiser, direction, supported market, fixed rate, quantities/limits, version and status |
| Trade agreement | Participants, immutable rate/amounts/destinations/rules, acceptance and activation evidence |
| Invoice | Party, principal, fees, charges, exact payable amount, precision and version |
| Deposit/payment | Expected/observed gross/net, asset/currency, source, external ID, verified state and timestamps |
| Payout obligation | Trade, recipient snapshot, amount, status, unique business identity and fulfillment evidence |
| Refund obligation | Original receipt, reason, source destination, gross/charge/net, status and evidence |
| Attempt | Obligation, stable request key, provider operation ID, sent/response/unknown status and retry linkage |
| Provider event | Provider/event ID, authenticity result, received time, original event time, processing result and protected payload reference |
| Reconciliation case | Matched/unmatched records, discrepancy, owner, evidence, resolution and audit trail |
| Support case/message | Owner, related transaction, visibility, evidence and status/history |
| Notification/delivery | Recorded event, recipient, channel, read/delivery state and deduplication identity |
| Audit event | Named actor/system, action, target, time, reason and relevant before/after/version references |
| Configuration version | Approved value, scope, effective date, actor, review evidence and affected future operations |

### 16.3 Ledger requirements

**Required safeguards:**

- Track customer entitlements, held funds, custody/provider positions, platform fees and outstanding payout/refund liabilities distinctly.
- Record every received amount, including mismatches and unmatched external money; reconciliation cannot depend on successful order matching.
- Keep units explicit. A USDT amount and a naira amount cannot be added as though they share a unit.
- Make postings immutable or equivalently protected; correct mistakes with traceable compensating records.
- Commit internal financial changes and their associated state transitions atomically where they share a transactional boundary.
- Prevent negative available balances except where a separately approved liability model explicitly allows a particular account type; no customer overdraft product is approved.
- Keep fees from cancelled trades refundable/returned. Do not recognize collected-for-a-trade money as earned platform revenue merely because it reached a bank account.
- Make reconciliation able to explain the movement from available balance to hold, settlement and release without double counting.

**Proposed baseline:** a double-entry ledger with database-enforced balancing/uniqueness and server-authoritative state transitions. Per-asset balancing is distinct from valuing cross-currency exchange. Final accounting mapping and fee-recognition policy require review by the responsible financial/engineering owners.

### 16.4 API contract expectations

Endpoint names and framework are undecided, but each operation must define input schema, authorization, idempotency, response/status recovery and error semantics.

| Operation family | Contract requirements |
|---|---|
| Balances/history | Authorized owner scope; precise amount strings/units; freshness/version and pagination |
| Quote/create/accept trade | Offer version, immutable quote/terms, eligibility, duplicate prevention and activation result |
| Fund Vault | Order ownership/role, exact invoice amount, eligible source, atomic balance check and funding reference |
| Send USDT | Quote ID/version, exact destination/network/amount, authorization binding, stable client request ID |
| Provider receipt/webhook | Authenticate source, deduplicate, durably record, validate canonical transaction and process safely |
| Payout/refund recovery | Admin authority, obligation ID/version, prior-attempt verification, reason and durable result |
| Status recovery | Query by authorized business reference without creating another payment |
| KYC/contact changes | Authorized customer, approved fields, verified provider lifecycle, sensitive-change protection |
| Offer edits/configuration | Optimistic concurrency/version guard and future-effective terms |
| Receipt/evidence download | Fresh authorization, minimum data exposure and controlled access lifetime |

Use stable machine-readable error categories mapped to helpful customer messages. Distinguish invalid input, insufficient balance, stale version, ineligible account, temporarily unavailable service, unknown external outcome and terminal failure.

### 16.5 Event processing and retries

- Treat repeated webhook delivery as expected; deduplicate by the appropriate provider transaction/event identity and business operation.
- Do not confuse a repeated event for one transfer with two distinct bank transfers.
- Persist a verified event before acknowledging durable processing as required by the provider contract.
- Handle out-of-order events without regressing a confirmed movement to pending or reopening a closed order.
- Record events that cannot yet be matched in a recoverable queue.
- Use an outbox/inbox pattern or equivalent to prevent database commits and queue dispatches from diverging.
- A worker crash after provider submission must recover the same operation, not blindly create another.
- The desired outcome is one financial effect per business operation despite retries; do not claim the network itself guarantees exactly-once delivery.

### 16.6 Frontend state and cache

The browser may cache display data and permitted form drafts, but cache is not a ledger. On reconnect, refresh balances, eligibility, quote validity, deadlines and operation status before enabling an action. Persist a request reference where needed to recover an interrupted submission. Do not keep secrets, identity evidence or bank-account data in generic analytics or insecure browser storage.

---

## 17. Integration and provider requirements

### 17.1 Fiat provider: current blocking finding

Monnify is the owner's earlier candidate. As checked on 28 October 2026, its published terms restrict transactions that enable cryptocurrency exchange with naira, and its support material lists cryptocurrency platforms among prohibited categories. These are provider statements, not a general legal conclusion about Zetmond. [R1][R2]

**Production consequence:** do not assume a standard Monnify integration is eligible. O06 requires an actually eligible provider/contract for Zetmond's disclosed model, supported by written confirmation and applicable terms. Ordinary API keys, a successful sandbox test or availability of virtual accounts do not resolve this restriction. Do not misdescribe the business to obtain access.

### 17.2 Fiat capability checklist

The selected eligible provider must support the actual intended flow, including:

- Permitted use for the approved market, customer type and business model.
- Trade-linked account allocation or an approved equivalent that reliably identifies receipts.
- Gross payment amount and currency, net/charge breakdown and authoritative transaction lookup.
- Adequate source-account/ownership information for name checks and original-source refunds, or a documented provider-supported return mechanism.
- Bank payout and refund initiation/status recovery with stable references and duplicate prevention.
- Signed/authenticated events or equivalent supported verification.
- Delayed, failed, unknown and reversed payment handling.
- Account expiry/reuse behaviour and late-receipt visibility.
- Limits, pricing, settlement availability, operating hours and support escalation suitable for the service.
- Reports needed to reconcile collection, provider positions, payouts and fees.

If a required capability is missing, the corresponding product flow must be redesigned and approved before implementation/launch. It cannot be invented by the frontend.

### 17.3 Custody and USDT integration

Decide supported network(s), custody/key-management arrangement, address issuance, confirmation/finality policy, internal Vault movement and external transfer model under O02/O03.

The integration must provide approved signing controls, transaction submission/status lookup, supported-address validation, custody balance visibility, withdrawal controls, chain/network outage handling and recovery procedures. A ticker match alone is insufficient: validate the configured supported asset identity on each network, including its official contract where relevant.

Customer-facing fees must account for the approved platform/network charging model. Whether network fees consume USDT or another asset in operations must be defined without exposing unsupported assets as customer balances.

### 17.4 KYC, bank verification and communications

Select providers/processes that support the launch countries and approved evidence. Document required versus optional data, result authenticity, failure/retry behaviour, retention responsibilities and support escalation.

Contact verification and notifications require delivery-state handling. Email/SMS failure must not turn an unverified contact into a verified one. Bank-name lookup failure must not become a successful ownership match.

### 17.5 Environment separation

- Separate development, automated tests, provider sandbox/staging and production credentials/data.
- Test fixtures cannot share live customer ledgers, collection accounts or custody keys.
- Production endpoints reject synthetic event triggers and debug bypasses.
- Feature enablement is server-controlled per approved capability, market and network.
- Operational configuration and credential rotation are auditable and follow least privilege.

---

## 18. Security, privacy and custody requirements

### 18.1 Authorization and transaction integrity

Enforce transaction authorization on the server and bind approval to the exact operation details. Material changes invalidate prior approval; execution checks the authorized state again. This aligns with OWASP's transaction-authorization guidance. [R4]

Required product controls include object-level ownership checks, input validation, replay protection, protected admin actions, safe session handling and prevention of client-side role/amount/status tampering. Threat modelling must cover customer takeover, malicious counterparties, compromised staff access and provider-event spoofing.

### 18.2 Application and infrastructure controls

- Encrypt communications and sensitive stored data with managed key access.
- Keep provider credentials, signing keys and verification secrets outside browser bundles and general application logs.
- Use the selected authentication design's CSRF/session protections, secure cookie/token handling and least-privilege service access.
- Prevent injection, XSS, insecure direct record access and unsafe file handling.
- Apply appropriate abuse/rate controls to login, OTP, signup, quotes, withdrawals, order creation and support uploads.
- Authenticate webhook endpoints and prevent replay while still allowing legitimate provider retries.
- Restrict outbound connections and protect server-side URL-fetch/file features where present.
- Maintain dependency updates, secret scanning and security review in the delivery pipeline.
- Use production-safe error messages and a logged correlation reference for investigation.

Specific technologies and numerical limits remain implementation/policy decisions. A single-role admin portal still needs strong authorization and credential protection.

### 18.3 Custody controls

Before accepting real assets, approve and test the custody model, signing authority, key recovery, backup procedure, withdrawal limits, hot/cold or equivalent storage policy, reconciliation and incident response. Private keys must not be returned to customer browsers or embedded in source repositories.

If a third-party custodian holds keys on Zetmond's behalf, document contractual control, asset availability, transfer authorization and failure/recovery responsibilities. The user-facing custodial model remains accurate; the implementation must not silently become self-custody.

### 18.4 Sensitive data and privacy

Collect only data required by the approved account, KYC, banking and operating obligations. Classify identity documents, financial records, bank destinations, contact/recovery details, authentication data and operational logs.

Define access, retention, deletion/restriction, export and backup handling for each class. Retention periods and jurisdiction-specific obligations require specialist approval; none are invented here. A deletion request cannot silently erase an outstanding financial obligation or protected audit record.

Staff access to identity evidence and full bank data must be justified, limited and logged. Avoid full payment/identity data in notification previews, analytics, error-report attachments and broad support exports.

### 18.5 Launch evidence

Security readiness requires a documented threat model, implemented controls, authorization/abuse tests, independent assessment appropriate to custody/financial risk, resolution of release-blocking findings and tested incident procedures. An attractive UI or authentication library alone does not establish these controls.

The business must obtain the appropriate specialist review for its actual operating model and markets, including relevant eligibility, screening, licensing/registration, customer disclosures, safeguarding and privacy duties. This PRD does not assert any regulatory approval.

---

## 19. Reliability, performance and service operations

### 19.1 Financial reliability

- Preserve every accepted financial operation and event across process restart.
- Recover incomplete workflows from durable state without repeating completed payments.
- Treat external timeout as unknown until provider evidence resolves it.
- Preserve deadlines after deployments and outages; no client-controlled resets.
- Track unmatched funds and unresolved liabilities until an authorized resolution.
- Keep an operational path for customers whose counterpart funded but a provider is unavailable.
- Pause new affected operations when the platform cannot safely verify or settle them; keep support, status and recovery available where feasible.

A deployment rollback must not reverse completed external transfers. Recovery uses forward corrections and compatible data/state handling.

### 19.2 Performance and availability targets

Numerical service levels need O28/O29 approval because expected volume, budget and provider capabilities are unknown. Before launch, publish an internal signed-off target sheet containing:

| Target | Definition to approve and test |
|---|---|
| Page responsiveness | Entry page/loading and interaction budgets on representative mobile/desktop devices and agreed network profiles |
| API latency | Percentile targets per read/write operation; exclude provider completion time only when clearly defined |
| Availability | Measurement window, eligible operations, exclusions and alert thresholds |
| Event processing | Acceptable verified-event-to-state-update delay and backlog limits |
| Settlement/refund | Internal processing objective, provider dependency, escalation age and customer wording |
| Capacity | Concurrent users, offers, active trades, event throughput and retention growth assumptions |
| Recovery | RPO/RTO, backup frequency, restore scope and named responder |

These must become concrete measured targets before release. “Fast,” “highly available” and “backed up” are not sufficient acceptance evidence.

### 19.3 Browser/device verification — proposed baseline

Test agreed current versions of Chrome, Edge, Firefox and Safari on desktop; Chrome on Android and Safari on iOS on physical or representative devices. Final version/OS support policy is O28. Include narrow screens, large text, browser zoom, orientation changes, keyboard navigation, screen-reader checks and software-keyboard behaviour.

Test a slow/interrupted connection, bank-app switching, suspended mobile tabs, two-device use and reconnect after expiry. Responsive CSS screenshots alone do not prove those flows work.

### 19.4 Monitoring and alerting

Monitor at least: failed logins/abuse, KYC/provider failures, address allocation failures, custody balances, unexpected deposit gaps, webhook verification/replay failures, event backlog, trade-state age, expired jobs, unknown external attempts, partial settlements, delayed refunds, reconciliation discrepancies and configuration changes.

Every alert requires severity, responsible owner, action/runbook and escalation route. Avoid logging raw secrets or full evidence to make alerts easier to implement.

### 19.5 Backups and disaster recovery

Back up the database, critical configuration, protected evidence metadata and custody recovery material according to the approved architecture. Test restoration, not only backup creation. After restore, reconcile with external systems before re-enabling outbound financial actions: the external bank/chain does not roll back with the database.

Record test date, restored point, missing/recovered events, unresolved liabilities and the actual achieved recovery time. Recovery objectives are unresolved until these can be reviewed against capacity/budget.

### 19.6 Incident operation

Prepare runbooks for custody compromise, suspected account takeover, duplicate or unknown payout, provider outage, reconciliation break, privacy incident and incorrect production configuration. Define who can pause the affected capability, what existing obligations continue, how customers are informed and how normal service resumes.

Customer wording must distinguish service interruption from confirmed loss or failed transfer. Do not promise a fixed recovery/refund duration without evidence and an approved service commitment.

---
## 20. Production acceptance scenarios

These checks apply to the actual backend and approved integrations, exercised through isolated automated tests and staging/provider sandboxes as appropriate. Final production readiness also requires the contractual, operational and launch evidence in Section 21. Monetary examples are test fixtures, not live exchange-rate commitments.

Each test record must identify requirement, preconditions, input/event, expected persisted state, expected financial effect, UI result, actual result and evidence. A disabled frontend button alone cannot pass a server-enforcement test.

### 20.1 Account, wallet and marketplace

| Test | Scenario | Required result |
|---|---|---|
| AT-01 | Unapproved KYC user calls wallet/trade APIs directly | Backend rejects; UI directs to verification; no money movement |
| AT-02 | User changes country/currency fields in a request | Server applies authorized country policy; unsupported settlement remains unavailable |
| AT-03 | Wallet estimate rate changes after trade acceptance | Estimate may refresh; accepted rate and invoice stay unchanged |
| AT-04 | Customer requests another user's balance, receipt, case or bank record | Denied without private-data disclosure |
| AT-05 | Ordinary customer calls admin endpoint | Denied regardless of path, visible navigation or client role field |
| AT-06 | External deposit is detected but below finality threshold | Pending/confirming; not available to spend |
| AT-07 | One external deposit event is repeated | One ledger credit and one applicable fee outcome |
| AT-08 | User supplies unsupported network/asset/destination | UI/backend reject outbound action; unsolicited inbound money is recorded/reviewed under policy |
| AT-09 | Withdrawal amount plus fees exceeds available funds | No reservation/submission; clear insufficient-funds message |
| AT-10 | Withdrawal quote expires or destination/amount changes | Fresh review/authorization required |
| AT-11 | Withdrawal submission times out after provider acceptance | Recover same operation; no duplicate transfer |
| AT-12 | Two withdrawals/trade holds compete for the same balance | At most the permitted available amount is committed |
| AT-13 | Advertiser edits rate after a customer's accepted order | Existing order unchanged; future orders use new version |
| AT-14 | Two orders compete for remaining offer quantity | Approved reservation policy prevents over-allocation |
| AT-15 | Advertiser prerequisites are incomplete | Offer publication blocked; missing requirements identified |
| AT-16 | Advertiser collateral is locked | It is excluded from available spendable funds |
| AT-17 | Offer is paused with active trades outstanding | New acceptance stops; existing obligations remain active |

### 20.2 Invoice, funding and deadlines

| Test | Scenario | Required result |
|---|---|---|
| AT-18 | 100 USDT at ₦1,300, excluding separately approved bank charges | Seller fee 0.50 USDT/deposit 100.50; buyer fee ₦650/deposit ₦130,650 |
| AT-19 | Seller enters 100 rather than required 100.50 USDT | Exact correction displayed; server blocks wrong funding |
| AT-20 | Seller funds first | One funding record; fresh server 15-minute counterpart deadline |
| AT-21 | Buyer funds first | Same timer rule with buyer funding recorded |
| AT-22 | First qualifying payment arrives at minute 19 | Deadline becomes minute 34, under approved timestamp semantics |
| AT-23 | Repeat event, page refresh, logout or device-clock change | No deadline reset and no duplicate monetary effect |
| AT-24 | Neither party funds by initial deadline | Cancel/expire with no fee and no fabricated refund |
| AT-25 | Only seller funded; second deadline expires without pending buyer evidence | Cancel and return seller principal plus platform-fee deposit |
| AT-26 | Only buyer funded; second deadline expires without pending seller evidence | Cancel and refund actual received amount less approved bank refund charge |
| AT-27 | Payment is pending/uncertain at deadline | Enter review; no concurrent settlement and refund |
| AT-28 | Customer tries to cancel after either party funded | UI has no cancel action; server rejects request |
| AT-29 | Customer opens old funding screen after their deposit | Shows received state; cannot submit another funding operation for that obligation |
| AT-30 | Payment arrives at the exact boundary or webhook is delayed | Apply the signed-off O11 policy using saved evidence; no device-clock decision |
| AT-31 | Worker restarts during expiry processing | Persisted job/state recovers without duplicate return or lost deadline |
| AT-32 | Account/address provisioning fails | No false funding instructions; activation/deadline handling follows approved O07/O10 |

### 20.3 Mismatch, settlement and refunds

| Test | Scenario | Required result |
|---|---|---|
| AT-33 | Buyer pays below invoice | Mismatch cancellation; source refund less bank charge; seller deposit/fee returned if present |
| AT-34 | Buyer overpays | Same cancellation/return rule; no kept excess or altered trade quantity |
| AT-35 | Provider deducts a fee but buyer's gross payment is exact | Compare against verified gross, separately account for charge; do not misclassify underpayment |
| AT-36 | Both exact deposits qualify | Create/recover the two settlement obligations without seller manual release |
| AT-37 | Buyer credit complete, seller payout pending | Show separate status; whole trade not marked completed |
| AT-38 | One leg succeeds, other fails | Preserve success; recover outstanding leg without duplicate payment or ordinary cancellation refund |
| AT-39 | Completed payout receives duplicate or out-of-order event | No second payout and no invalid lifecycle regression |
| AT-40 | Mismatch event races with settlement/expiry job | Canonical guards allow only the correct financial outcome |
| AT-41 | Cancelled trade included platform-fee deposits | Zero retained platform fee; return components traceable |
| AT-42 | Bank refund is queued/unknown/failed | Refund obligation stays outstanding; no “refunded” success claim |
| AT-43 | Fiat arrives after cancellation | Link to original order, record liability and start return/review; do not reopen trade |
| AT-44 | Refund source is unverified or account-holder mismatch exists | Follow approved O14 review; no arbitrary replacement destination |
| AT-45 | Bank refund charge is unknown or ≥ gross | No invented/negative refund; apply approved exceptional-charge policy |
| AT-46 | Split payments or separate duplicate transfers arrive | Distinguish actual money from duplicate events; apply approved O12, not invented aggregation |
| AT-47 | Completed bank transaction later reverses | Preserve original evidence; create linked exception and apply approved O18 recovery |
| AT-48 | Seller edits/removes bank account after agreement | Existing destination snapshot remains; no silent redirection |
| AT-49 | Admin retries an unknown payout | Prior attempt verified; stable operation identity prevents duplicate movement |
| AT-50 | Reconciliation discovers unmatched funds | Record and retain a discrepancy/liability case until resolved |

### 20.4 Responsive experience, security and operation

| Test | Scenario | Required result |
|---|---|---|
| AT-51 | Customer completes onboarding → quote → payment monitoring → receipt on phone | All needed actions/details available with no desktop-only dependency |
| AT-52 | View at 320/390/768/1024/1440px and intermediate widths | No clipped totals, hidden fees, unreachable primary actions or essential two-dimensional scrolling |
| AT-53 | Mobile keyboard opens on amount/OTP/support form | Label, error and primary action remain usable; no accidental submit from layout movement |
| AT-54 | Drawer/dialog used by keyboard and screen reader | Labelled controls, correct focus containment/return and no background access while modal |
| AT-55 | Text zoom/enlargement, reduced motion and alternate input | Content remains readable and operable under approved accessibility target |
| AT-56 | Customer switches to bank app and returns after browser suspension | Recover correct server funding state/deadline without duplicate action |
| AT-57 | Network drops after confirming a money action | Stable reference and status recovery; no misleading failed/completed claim |
| AT-58 | Support case contains malicious or unauthorized attachment | Validated/restricted access; no unsafe execution or data leakage |
| AT-59 | Security/contact change or session revocation occurs | Approved session/security policy enforced across devices |
| AT-60 | Forged provider event or tampered amount/role reaches backend | Rejected/audited; no financial effect |
| AT-61 | Real user enters production | No fake balances, sample users, mock KYC, role switcher or debug event controls |
| AT-62 | API/provider outage or queued work backlog | Accurate unavailable/review state, alerts and safe operational pause where required |
| AT-63 | Data restore follows an external payout | Reconcile external result before retries; no second payout caused by restored old state |
| AT-64 | Receipt downloaded before both trade payouts finish | Truthful pending/partial record; not a completed-trade receipt |
| AT-65 | Notification delivery fails or repeats | No financial-state/deadline change; appropriate message deduplication |
| AT-66 | Configuration changes fees/limits | Approved future-effective version; accepted order terms unchanged |
| AT-67 | Restricted account has an ongoing financial obligation | Apply approved restriction/recovery policy while preserving evidence and liabilities |
| AT-68 | Admin attempts direct balance alteration or unapproved force-completion | Operation unavailable/rejected and auditable |

### 20.5 Tests blocked by unresolved policy

AT-10/30/32/44/45/46/47/59/67 and other provider-dependent checks cannot be signed off by inventing a test default. Link the approved decision and policy/configuration version to the test evidence first. Security, concurrency and invariant tests can be implemented while commercial details are still being resolved.

---

## 21. Delivery sequence and release gates

### 21.1 Implementation tasks — owner-requested order

Each task includes backend behaviour, responsive screens, authorization, durable records, exceptional states and relevant tests. This is a dependency sequence, not a launch date or an approval to bypass unresolved policies.

| Task | Deliverables | Completion evidence |
|---|---|---|
| 1 — Production foundation | Approved stack, environments, migrations, API conventions, background jobs, observability and shared responsive components | Repeatable setup, CI, database connectivity and isolated environments |
| 2 — Accounts and authentication | Registration, country eligibility, shared login, contact verification, recovery, sessions, approved MFA and role enforcement; final admin portal delivered in Task 10 | Secure account journeys and direct API authorization tests |
| 3 — KYC and bank verification | Real KYC integration, identity status/corrections, verified destinations and financial eligibility gates | Verified outcomes and enforcement for approved versus unapproved users |
| 4 — Ledger and custody foundation | Exact accounting, balances, holds, Zetmond-managed custody interfaces, protected signing, unique operation IDs and event processing | Financial invariants, concurrency, event deduplication and recovery tests |
| 5 — Customer wallet | Overview, TRC-20 receiving addresses, deposits, quoted/authorized withdrawals, status recovery and receipts | End-to-end verified wallet flows and unknown-outcome recovery |
| 6 — Marketplace and advertisers | Buy/Sell offers, filters, approved tiers, applications, collateral, offer management and inventory reservations | Eligible offer management and prevention of inventory over-allocation |
| 7 — Agreements and invoices | Order acceptance, protected destinations, fixed rates, exact fees and immutable versioned invoices | Accepted terms preserved; monetary calculation and acceptance tests |
| 8 — Account services and operational foundations | Activity, notifications, settings/security, support, approved policies, monitoring, backups and reconciliation processing | Working customer services and tested operational foundations |
| **9 — Vault (second to last)** | Trade-linked collection instructions, internal seller funding, 20/15-minute deadlines, payment verification, seller-first settlement, cancellation/refunds, late receipts and partial-success recovery | Both funding orders, boundary/expiry, mismatch, duplicate, restart and settlement/refund race tests |
| **10 — Admin portal (last) and final release validation** | Role-protected admin workspace, KYC/advertiser queues, user/trade investigations, financial recovery, reconciliation, support, configuration and protected audit history; final cross-product validation | Audited authorized actions, second-admin approval controls and applicable production release-gate evidence |

Build operational records, permissions and recovery mechanisms with their underlying features so the last admin task can use them. Earlier feature work uses isolated tests/staging and does not enable public real-money operations before the final operational surface and applicable release gates are ready. Keep the completed marketing site; integrate approved entry paths without rebuilding it.

Work on foundations, schemas and isolated tests may proceed while external decisions remain open. Missing providers, contracts, key-management design or policy details block the affected capability, not useful independent work. No simulated success may substitute for a live capability.

### 21.2 Production go/no-go checklist

| Gate | Required evidence | Suggested accountable owner; assignment required |
|---|---|---|
| G01 Product policy | Launch markets, eligibility, complete fees, rounding, acceptance/timing and exception decisions approved | Product owner |
| G02 Fiat eligibility | Eligible contract/provider for the disclosed model; required collection/payout/refund capabilities verified | Business/operations |
| G03 Custody | Approved network/key/signing model, recovery drill and reconciliation | Engineering/security |
| G04 Identity and privacy | KYC process, required disclosures, retention and data-handling approvals | Responsible compliance/privacy owner |
| G05 Financial integrity | Concurrency, idempotency, matching, settlement/refund and ledger tests pass | Backend/QA |
| G06 User experience | Every in-scope journey works on approved device/browser matrix | Frontend/design/QA |
| G07 Security | Threat model, independent review and release-blocking findings resolved | Security |
| G08 Operations | Named responders, monitoring, reconciliation cadence, support and incident runbooks | Operations |
| G09 Recovery | Measured restore, event replay and external-result reconciliation drills | Engineering/operations |
| G10 Capacity | Approved load/performance/availability objectives validated | Engineering/product |
| G11 Release | Controlled rollout plan, feature gates, migration/rollback procedure and support coverage | Release owner |
| G12 Clean production surface | No test data, bypasses, synthetic funding/approval controls or misleading success states | Engineering/QA |

A role title in this table is a responsibility, not an assumption that a person has been hired. Assign real accountable owners before launch.

### 21.3 Rollout and change management

Define the first market/network and any pilot limits through owner approval; no numeric pilot size is assumed. Maintain the ability to stop new affected activity without losing existing funds, statuses or refund obligations. Re-enable only after incident review and reconciliation.

Schema/configuration changes must be versioned and tested against active trades. Deployments should preserve backward-compatible processing of in-flight events and accepted rule versions. Do not modify accepted financial terms through a general application rollback.

### 21.4 Definition of done for the application

- All in-scope screen families and exceptional states are implemented responsively.
- Backend authorization and financial rules are tested beyond the UI.
- Real integrations are configured for approved eligible capabilities.
- Balances, invoices, payments and receipts are traceable and reconcilable.
- Settlement/refund recovery works after timeout, duplicate delivery, crash and partial success.
- Required policy, custody, security and operational gates have evidence.
- The owner has approved any phased exclusions and remaining non-blocking follow-up work.

---

## 22. Measurement and analytics

### 22.1 Product and operational measures

| Measure | Definition |
|---|---|
| Onboarding completion | Eligible registrations reaching approved KYC, with stage-specific drop-off |
| Wallet funding | Verified deposits credited; pending/review separately visible |
| Invoice comprehension | Users can identify principal, platform fee, total deposit and expected receipt in usability checks |
| First funding | Accepted orders receiving a qualifying deposit, segmented by buyer/seller first |
| Both-funded rate | Accepted orders reaching two verified deposits, separately from unfunded expiry |
| Settlement completion | Trades with both payout obligations fulfilled |
| Settlement latency | Time from both qualifying deposits to both fulfilled obligations |
| Refund completion/age | Created returns reaching confirmed completion; unresolved age by reason |
| Reconciliation breaks | Count, amount by currency/asset, reason and age of unresolved discrepancies |
| Duplicate financial effects | Violations of the one-operation/one-effect invariant; release/incident severity indicator |
| Platform fees | Pending/refundable, earned and returned amounts by currency/asset |
| Support demand | Case volume, cause, age, response/resolution and reopened cases |
| Experience quality | Real failure/latency measures by browser/device, without sensitive payload collection |

Commercial numeric targets, support SLAs and reporting valuation methods remain O24/O28/O29. Do not add USDT and fiat fee totals without an approved reporting conversion definition.

### 22.2 Event instrumentation

Use non-sensitive event names such as `kyc_submitted`, `quote_reviewed`, `trade_accepted`, `funding_verified`, `trade_review_opened`, `settlement_obligation_completed`, `refund_completed` and `support_case_created`.

Server events provide evidence of financial outcomes. A browser click named “payment_success” is not proof of money movement. Analytics must avoid passwords, identity documents, full account numbers, wallet secrets and unnecessary personal data. Access/retention for analytics follows the privacy policy.

---

## 23. Owner decision register and remaining TBDs

### 23.1 Status and authority

The following answers were explicitly supplied or approved by the owner in the decision review ending 3 November 2026 (Africa/Lagos). “Approved” records product intent, not implementation completion or provider/legal feasibility. “Approved baseline; details TBD” means only the stated baseline is approved. Resolve remaining details before enabling the affected operation. The original O01–O29 identifiers are retained.

### O01 — Launch countries and markets — Approved

- Nigeria: NGN (Nigerian naira).
- Ghana: GHS (Ghanaian cedi).
- South Africa: ZAR (South African rand); owner's “SA” was interpreted as South Africa in the review.
- Kenya: KES (Kenyan shilling).
- Registration and local-currency P2P trading are intended in each of these four markets, subject to eligible providers and launch gates. No cross-currency trading policy or legal eligibility is inferred.

### O02 — Supported USDT network — Approved

USDT on **TRON (TRC-20) only** at launch. Other networks are not enabled. Confirm official asset identity and network finality rules during integration.

### O03 — Custody and Vault movements — Approved baseline; details TBD

Zetmond manages custodial customer wallets. Seller-to-Vault funding uses Zetmond's internal ledger, not a per-trade on-chain transfer. External deposits and withdrawals use TRON. Key generation, secure signing infrastructure, key access/recovery, custody account mapping, TRON resource management and finality thresholds remain to be designed, approved and tested. Internal ledger funding must be labelled truthfully.

### O04 — External deposit and withdrawal fees — Approved baseline; limits TBD

| Item | Approved policy |
|---|---|
| External deposit platform fee | 0.1% of gross receipt, minimum 0.10 USDT |
| Minimum deposit credited | 1 USDT; smaller receipts remain recorded for review |
| External withdrawal fee | Estimated TRON network cost, quoted in USDT before confirmation |
| Minimum withdrawal | 10 USDT, excluding fees |
| Outgoing network cost | Paid by the customer; Zetmond handles TRON resource management |
| Maximum withdrawal | Configurable by verification level and risk limits; numeric values TBD before launch |

These external-transfer fees are distinct from the 0.5% P2P fee per party. The review did not settle whether the 1 USDT credit threshold is measured gross or net, treatment of accumulated sub-threshold receipts, or any additional withdrawal platform fee; do not invent these details. Final fee quotes must follow O16.

### O05 — Local-currency estimates — Approved baseline; provider TBD

Refresh estimates every 60 seconds and mark them stale after 5 minutes. Use the customer's registration-country currency; country changes require verification. Keep estimates separate from advertisers' fixed P2P prices. A reliable rate provider, conversion methodology, outage behaviour and country-change verification procedure still need selection/definition.

### O06 — Fiat providers — TBD

No fiat collection/payout/refund provider has been selected for NGN, GHS, ZAR or KES. The owner requested research, then explicitly deferred this decision as TBD when live research was blocked by network policy. Yellow Card and OVEX were unverified preliminary candidates only, not selected or confirmed eligible. The v1.0 Monnify finding is a historical document statement, not independently reverified in this review.

Obtain eligible contracts and written capability confirmation for Zetmond's disclosed custody/P2P flow, trade-linked accounts, gross receipt/source verification, payouts, original-source refunds, late funds and all enabled markets. API keys or sandbox success alone do not resolve eligibility.

### O07 — Trade collection allocation — Approved baseline; lifecycle details TBD

Use a unique fiat collection account per trade and a unique trade reference for internal seller USDT funding. Link late receipts to their original trade for review/refund; never silently reactivate a cancelled trade. Provider support, allocation/provisioning guarantees, account expiry/reuse rules and original-source return mechanics remain TBD. Do not reuse a destination until late-receipt attribution is reliably preserved.

### O08 — Advertiser requirements — Approved initial policy

| Category | Level | Locked security deposit (USDT) | Maximum per trade (USDT) |
|---|---|---:|---:|
| General | Beginner | 100 | 500 |
| General | Regular | 250 | 2,000 |
| General | Veteran | 500 | 5,000 |
| Verified | Bronze | 1,000 | 10,000 |
| Verified | Silver | 2,500 | 25,000 |
| Verified | Gold | 5,000 | 50,000 |
| Block | Separate category | Individually approved | Individually approved |

- Fiat limits use the corresponding value; the exact conversion/version policy remains to be specified.
- Every advertiser needs approved KYC, verified email and phone, bank-name match, the funded security deposit and no unresolved account restrictions.
- Regular eligibility: at least 30 completed trades over 30 days.
- Veteran eligibility: at least 100 completed trades over 90 days.
- Verified levels require manual business/risk review, relevant trading history and sufficient liquidity; detailed level-specific criteria remain TBD.
- Count genuine trades only; exclude self-trading and manufactured activity. Exact history-window definitions and detection/review procedures remain to be specified.
- Benefits: higher limits and visible category badges. The 0.5% P2P fee per party stays unchanged.
- Security collateral is separate from trade principal and is not insurance or a guarantee. Provider feasibility and collateral sufficiency require validation; deductions remain subject to O09/O21.

### O09 — Advertiser lifecycle — Approved baseline; deductions TBD

Admins review applications and tier changes against eligibility. Meeting numerical thresholds creates eligibility for review, not an automatic upgrade. Restrictions stop new offers while preserving active trades and obligations. Release collateral only after active obligations and disputes are resolved. No automatic collateral deductions; permissible deduction grounds, amounts and process remain TBD. O21's second-approval requirement does not itself authorize a deduction.

### O10 — Acceptance and activation — Approved

Publishing an offer counts as advertiser acceptance. The customer's acceptance of the final invoice activates the agreement only after both funding instructions are available. The initial 20-minute funding window begins at that activation point. Atomically validate eligibility, current offer version, inventory and protected invoice terms.

### O11 — Payment event and deadline interpretation — Approved baseline; provider mechanics TBD

Use verified receipt time: the committed Zetmond ledger timestamp for seller funding, and the provider's verified receipt timestamp for buyer fiat. Payments received **at or before** the applicable deadline qualify. Uncertain/pending evidence and delayed notifications enter review before settlement or refund decisions. A verified qualifying first payment starts the fresh 15-minute window once, based on its receipt timestamp. Repeated events do not reset time.

Provider timestamp authenticity, clock handling, finality verification and the operational review/escalation process still need implementation specifications. A browser click or unverified webhook cannot establish payment.

### O12 — Split, duplicate and unexpected payments — Approved

- Do not combine split fiat payments to satisfy an invoice. Cancel and return each verified receipt, less applicable refund charges, subject to O14/O17 and no already-fulfilled settlement obligation.
- Process duplicate notifications for one movement only once.
- Record separate duplicate or extra transfers as separate money. Return extra funds without changing the original trade's valid outcome or duplicating its settlement.
- Unexpected crypto receipts enter review and do not automatically count as Vault funding.
- Preserve all received amounts and references, including unmatched funds. Partial-settlement safeguards override ordinary cancellation; never return a liability already discharged.

### O13 — Manual unfunded cancellation — Approved

Either party may cancel only while neither has paid and no payment is pending. The backend must recheck atomically with competing payment/expiry handlers. Pending or uncertain payments enter review. Once either party pays, customer cancellation is unavailable.

### O14 — Payment source and refunds — Approved baseline

Accept ordinary trade fiat only from an account verified as belonging to the buyer. Third-party payments or name mismatches enter review and are returned to the verified original source. If the source cannot be identified, preserve the received funds and liability under review; customers cannot substitute another refund account. Provider-supported name matching and source-verification procedures still require specification.

### O15 — Successful-trade bank charges — Approved

The buyer pays collection charges; the seller pays payout charges. Show each separately from the 0.5% platform fee and disclose its effect on the exact deposit or net receipt before acceptance. Obtain provider-backed charges; do not invent amounts. Reconcile gross buyer payment separately from any provider deduction. The approved quote/calculation must be snapshotted in the accepted invoice.

### O16 — Precision, rounding and minimum P2P order — Approved baseline; tax TBD

- USDT amounts: 6 decimal places.
- Fiat: the currency's official minor units (NGN, GHS, ZAR and KES currently use two decimal places; validate supported provider units).
- Rates: up to 8 decimal places.
- Round calculated principals and fees once using **round half up**, then persist exact accepted totals and the rule version.
- Minimum P2P order: 10 USDT. No additional minimum P2P platform fee.
- Tax treatment remains TBD pending country-specific advice.
- Exact decimal/integer-unit arithmetic is mandatory. Document a deterministic sequence consistent with this policy before financial activation; unresolved calculation-order edge cases must not be chosen silently.

### O17 — Refund charges and small returns — Approved exception process; resolution details TBD

If a bank refund charge equals or exceeds the received amount, enter manual review. Preserve the outstanding liability; do not create negative refunds, erase balances or impose extra customer charges without approval. No separate crypto return fee applies to cancelled trades. Final resolution, escalation timing and cost-bearing policy for these exceptional small returns remain TBD.

### O18 — Settlement ordering and recovery — Approved baseline; reversal liability TBD

Initiate seller fiat payout first. After verified payout success, credit the buyer's agreed USDT principal internally. Mark the trade completed only when both obligations succeed. Verify unknown external outcomes before retrying and preserve successful legs while recovering only outstanding obligations. Later reversals enter manual review; no automatic customer debit is authorized. Numeric retry/escalation limits, liquidity/prefunding requirements and post-completion reversal liability remain TBD.

### O19 — KYC and eligibility — Approved baseline; provider/documents TBD

Customers must be 18 or older. Require government ID plus selfie/liveness verification through a provider/process covering the four launch countries. Financial access requires approved KYC. Identity changes or risk events may trigger reverification. Provider, accepted country-specific documents, evidence/finality rules, ongoing restriction/reverification details and related exception handling remain TBD. Never discard existing financial obligations when eligibility changes.

### O20 — Authentication and account security — Approved baseline; exact limits TBD

- Password minimum: 12 characters; support password managers and paste.
- Authenticator-app MFA is mandatory for administrators and required for customer withdrawals and sensitive account changes.
- Provide single-use recovery codes; support contact alone cannot recover an account or bypass security.
- Apply rate limits and temporary lockouts for repeated failed attempts.
- Revoke affected sessions after password recovery and issue security notifications.
- Exact session timeouts, lockout/attempt values, OTP lifetimes, MFA challenge/transaction-binding details and recovery procedures remain TBD. Do not infer that every customer login requires MFA from the narrower approved action policy.

### O21 — Admin provisioning and authority — Approved baseline; action policies TBD

The owner provisions individually named admin accounts with mandatory MFA and one role. No shared staff credentials or public admin signup. Admins may review cases and recover outstanding obligations through authorized, idempotent, audited workflows. Arbitrary balance editing and force-completion are prohibited.

Collateral deductions, exceptional financial adjustments and sensitive financial configuration changes require approval by a second named admin. The initiator cannot approve their own request. This control does not establish otherwise-unapproved deduction grounds or adjustment powers; the detailed action/approval matrix and thresholds remain TBD. Admin API enforcement is independent of the shared login redirect.

### O22 — Ordinary customer contact checks — Approved

Every customer must verify **both email and phone** before wallet or trading access, not only advertisers. Server-side gating applies to direct API calls as well as UI actions.

### O23 — Marketplace behaviour and inventory — Approved baseline; metrics definitions TBD

- Filters: currency, amount and advertiser category.
- Default sorting: best price from the viewer's Buy/Sell perspective.
- Show only real completed-trade metrics; exact formulas, periods and tie-breaks remain to be specified.
- No public reviews or user-to-user chat at launch.
- Reserve offer inventory when a trade activates; release unused reservations after cancellation.
- Inventory reservations are not Vault funding and must not start the 15-minute clock.
- Apply atomic quantity/version checks to prevent over-allocation. Releasing offer inventory cannot release funds still owed under a payout/refund obligation.

### O24 — Notifications, support and evidence — Approved baseline; retention/liability TBD

- Notifications: in-app and email. SMS is for phone verification only at launch.
- Customers may submit support cases at any time.
- Staffed hours: Monday–Friday, 09:00–18:00 **Africa/Lagos**.
- Target first response: within one business day; this is a first-response target, not a resolution or refund guarantee.
- Customers may appeal case decisions.
- Evidence: PDF/JPG/PNG, maximum 10 MB per file, with access controls and malware checks.
- Retention periods, dispute liability, appeal/escalation time limits, total attachment limits, holiday coverage and staffing assignments remain TBD. Approval of staffed hours does not establish actual support coverage.

### O25 — Stack and repository structure — Approved baseline; custody infrastructure TBD

- Customer app and separate admin app: Next.js/React.
- Backend: NestJS with TypeScript.
- Durable financial database: PostgreSQL.
- Background jobs: Redis/BullMQ with database-backed recovery; Redis is not the ledger.
- Permitted documents: private encrypted object storage.
- One repository contains the existing marketing site, customer app, admin app and backend. Preserve the completed marketing implementation.
- Custody signing/key-management infrastructure, hosting/services, exact versions and final deployment/accounting design remain to be selected. A shared repository does not imply shared production credentials or admin permissions.

### O26 — Shared login, domains and deployment — Shared login approved; exact domains TBD

The owner replaced the separate-login-page requirement: customers and admins log in on the **same page**. Admin login details are provisioned in the database in advance; store passwords as secure hashes, never plaintext. The backend authenticates, checks the account role, enforces mandatory admin MFA and redirects to the appropriate portal. Every privileged request rechecks authorization. There is no public admin signup.

The owner plans to purchase a domain; no exact domain name, ownership or final subdomain topology was confirmed. Earlier example hostnames were suggestions only. Final hosting, deployment/access rules and cross-origin/session design remain TBD; retain production/staging separation, HTTPS and isolated privileged access as required safeguards.

### O27 — Visual and responsive baseline — Approved

The owner approved the PRD's proposed purple styling/tokens, mobile drawer navigation, stacked mobile cards and responsive breakpoints. Retain the seven customer navigation sections and accessible responsive behaviour. Approval does not waive contrast, keyboard, focus, large-text or touch validation. Original proprietary fonts/assets beyond those already available are not claimed supplied.

### O28 — Browser, accessibility and service targets — Approved targets; implementation evidence/details TBD

- Support current and previous major versions of Chrome, Edge, Firefox and Safari, including Android Chrome and iPhone Safari.
- Accessibility target: WCAG 2.2 AA.
- Initial monthly availability target: 99.9%.
- Encrypted daily backups plus continuous database recovery; target RPO at most 5 minutes and RTO at most 4 hours.
- Immediate critical incident alerts with a named on-call responder.
- Numeric performance budgets, availability measurement scope/exclusions, acknowledgement/response times, alert thresholds, roster, provider dependencies and tested recovery arrangements remain TBD. Targets must be provisioned, measured and validated before becoming customer promises. Restores require external reconciliation before financial retries.

### O29 — Budget, volume, team and schedule — Explicitly deferred

- Budget: not set / TBD.
- Expected launch volume: not set / TBD.
- Development arrangement: product owner and AI assistant.
- Launch date: none set.

No schedule, infrastructure affordability, staffed operations or specialist sign-off is inferred. Keep planning incremental and preserve the owner's task ordering; scope changes require an explicit owner decision.

### 23.2 Outstanding decisions and prerequisites

The question review is complete, but these items remain open. Approval of an exception review process does not authorize an arbitrary financial resolution.

| Area | Remaining work | Related IDs |
|---|---|---|
| Fiat rails | Eligible provider(s), written contracts and capabilities in all four markets; actual fees and return support | O06/O07/O14/O15 |
| Custody | Signing/key management, recovery, network finality/resource policy and tested reconciliation | O02/O03/O25 |
| Deposit/withdrawal details | Maximum withdrawal limits, deposit gross/net threshold definition and small-receipt treatment | O04 |
| FX | Provider, conversion freshness/outage methodology, country-change process and tier fiat-limit mapping | O05/O08 |
| Collection lifecycle | Provisioning, expiry, reuse, late funds, reliable timestamps and review escalation | O07/O10/O11 |
| Advertisers | Detailed Verified/Block criteria, history windows, collateral deductions/release process and per-account exposure limits | O08/O09/O21 |
| Monetary policy | Detailed deterministic calculation sequence, taxes and exceptional small-refund cost/resolution rules | O15/O16/O17 |
| Settlement | Numeric retry/escalation limits, prefunding/liquidity and post-completion reversal liability | O18 |
| Identity/security | KYC provider/documents, restriction exceptions, exact timeouts/lockouts and recovery procedures | O19/O20 |
| Administration | Action/approval matrix, permitted financial adjustments, provisioning and actual second approver | O21 |
| Support/privacy | Retention, dispute liability, appeals/escalation limits, staffing, holiday coverage and evidence totals | O24 |
| Infrastructure | Hosting, exact domain(s), deploy/session configuration and operational service selections | O25/O26 |
| Service commitments | Performance budgets, availability definitions, actual on-call coverage and verified restore/incident targets | O28 |
| Planning | Budget, expected volume and any future schedule; specialist/operational responsibilities | O29 |

Resolve applicable blockers before enabling real financial capabilities. Feature gates must reflect actual approved and verified capability. Keep decision versions and approval evidence linked to affected invoices, configuration and acceptance tests; subsequent policy changes must not rewrite accepted trades.

---

## 24. Traceability to the main PRD

| Main PRD source | This document | Treatment |
|---|---|---|
| Sections 1–3; D01–D24/D26 | Sections 1–5 and BR-01–BR-23 | Confirmed product rules retained; detailed responsive/production requirements added |
| D25; prototype cover and Section 18 | BR-24; Sections 1.3, 17.5, 20 and 21 | Production instruction supersedes customer simulation; isolated test environments remain necessary |
| Section 7 / ACC | Sections 4 and 7 | Real identity, contact, eligibility and access enforcement |
| Section 8 / WAL | Section 8 | Real custody/ledger flows, exact fees and recovery |
| Section 9 / P2P and advertiser model | Section 9 | Fixed-rate offers, approved categories and protected inventory |
| Section 10 / FEE | Section 10 | 0.5% each, deposit addition, immutable invoice and unresolved bank-charge/rounding policy |
| Section 11 / VLT | Sections 11–12 | 20/15-minute rules, both funding orders, review, separate settlement and refunds |
| Section 12 / page inventory | Section 15 | Complete logical screens plus desktop/mobile treatment and production states |
| Section 13 / visuals | Section 6 | Purple identity and seven-section structure retained; proposed measurable responsive baseline |
| Section 14 / ADM | Section 14 | Real queues, evidence, authorized recovery and reconciliation |
| Section 15 / account services | Section 13 | Durable activity, notifications, settings and support |
| Sections 16–17 / records and safeguards | Sections 16–19 | Production financial integrity, integrations, security and operations |
| Section 19 / AC | Section 20 | Expanded backend, integration, exception and responsive acceptance |
| Sections 20–21 / delivery and measures | Sections 21–22 | Production sequence and release evidence replace prototype completion criteria |
| Section 22 / O01–O29 | Section 23 | Owner-approved decisions recorded with explicit remaining TBDs; no fabricated defaults |

### 24.1 Design-reference boundaries

The original seven desktop screenshots establish visual continuity. The later private preview and mobile concept help illustrate components and responsive composition. They do not override the source's unresolved policy questions.

In particular, sample advertiser statistics, sample rates, visible TRC-20/network text, unrestricted currency choices, automatic identity approval, unfunded cancellation and arbitrary admin actions must not enter production merely because a visual reference contains them.

### 24.2 Handoff expected after this PRD

The following implementation artifacts can be produced once the relevant decisions are resolved; they are not claimed completed by this file:

- Approved design tokens and screen/component specifications.
- Architecture decision records and repository/environment setup.
- Database schema and ledger/account mapping.
- API/event contracts and exact state-transition guards.
- Provider integration specifications and verified capabilities.
- Test plan with fixtures, edge cases and evidence.
- Security threat model and operations/reconciliation runbooks.
- Production configuration, release plan and readiness sign-offs.

---

## 25. References and glossary

### 25.1 Product sources

- **Primary:** [Zetmond_Product_Requirements_Document_v1.0.md](https://chatgpt.com/library?file_id=libfile_d76d13f382188191bbb9c1bf8b52bdb8&account_id=personal), dated 19 October 2026; current contents read for this specification.
- **Latest scope instruction:** owner's 28 October 2026 request for a mobile/desktop web-app PRD based on the main PRD, explicitly for real users rather than a prototype.
- **Visual references:** `zetmond home page.png`, `zetmonf p2p market.png`, `zetmond vault.png`, `zetmond activity page.png`, `zetmond support page.png`, `security page.png`, `settings page.png`; later Zetmond app design preview and generated mobile concept. Original main-PRD description and the visible conversation establish their role; reconstructed tokens are labelled proposed.

### 25.2 External references checked on 28 October 2026

External references support the specific provider/accessibility/security observations cited above. They do not establish Zetmond's commercial policies, legal eligibility or implementation completion.

| Ref | Primary source | Specific use |
|---|---|---|
| R1 | [Monnify Terms of Service](https://monnify.com/terms) | Published restrictions relevant to the proposed crypto-naira flow |
| R2 | [Monnify: The sectors we power](https://support.monnify.com/topics/introduction-to-monnify-236/the-sectors-we-power-481) | Published prohibited-business category information |
| R3 | [W3C Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/) | Proposed accessibility target; reflow and target-size distinctions |
| R4 | [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) | Server-side transaction authorization and protection of approved operation details |

### 25.3 Glossary

| Term | Meaning |
|---|---|
| Custodial USDT wallet | Customer account whose asset keys/control are managed through Zetmond's approved custody arrangement |
| Local estimate | Indicative fiat value of a specified USDT balance, not spendable fiat |
| Principal | Agreed exchanged amount before platform fees and separate approved charges |
| Platform fee | 0.5% funded by each trade participant in their deposit; retained only according to successful-trade policy |
| Vault | Deposit verification and settlement/return orchestration for a trade |
| Qualifying payment | Verified event that satisfies the approved funding policy and can affect the deadline/state |
| Hold/reservation | Amount unavailable for other spending because it is committed to an identified purpose |
| Settlement obligation | Recorded duty to credit the buyer's USDT or pay the seller's fiat |
| Refund obligation | Recorded duty to return received money according to cancellation/source/charge rules |
| Unknown outcome | A request may have executed externally but its result is not yet confirmed |
| Idempotency | Repeating the same business request/event does not produce another financial effect |
| Reconciliation | Explaining internal financial records against bank, provider and custody evidence |
| Compensating entry | Traceable correction/reversal record preserving prior financial history |
| RPO / RTO | Approved tolerable recovery-point loss / recovery-time objective |
| Release gate | Required evidence before enabling the affected production capability |

---

**End of Zetmond Production Web Application PRD v1.1.**

This document specifies a production service for real users on desktop, tablet and mobile web. It preserves the confirmed product model, defines required financial and operational safeguards, and lists the decisions that still require owner approval before the affected features can go live.
