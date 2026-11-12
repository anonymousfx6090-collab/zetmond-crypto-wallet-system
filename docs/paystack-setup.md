# Paystack setup for Nigerian bank verification

The owner selected **Paystack** for Task 3's Nigerian bank integration, replacing Monnify as the working choice. Smile ID remains the identity provider. Nigeria/NGN is the only active launch market; Ghana and Kenya remain deferred.

**Current status:** the server has a read-only Nigerian bank-list and account-name lookup client, with an owner-operated setup check. It is not yet a bank-ownership adapter and is not connected to customer bank approvals. The owner reports creating a Test Mode account and saving `PAYSTACK_MODE` and `PAYSTACK_SECRET_KEY` on Render. Supplied logs confirm staging is live. After the first parser correction, the owner supplied `invalid_response: catalogue_duplicate_code`, demonstrating that a catalogue page passed its shape checks but included repeated active codes. The duplicate-handling follow-up awaits deployed confirmation. A completed catalogue check remains unverified. No payment, transfer, subscription or production capability was activated.

## Create the account

1. Open [Paystack signup](https://dashboard.paystack.com/#/signup), create the business account and complete its requested verification steps.
2. Open the dashboard in **Test Mode**. Confirm which Nigerian account-resolution and customer-validation features are available for that account, and use Paystack's documented test fixtures.
3. Obtain the **test secret key** through the dashboard's API-key settings. Keep it private. The API server needs a secret beginning with `sk_test_`; a `pk_test_` public key cannot authenticate these server requests. Dashboard labels may change.
4. Confirm with Paystack whether its services and agreement support Zetmond's disclosed custodial USDT wallet and P2P marketplace, including the intended bank-verification use. Record actual feature availability and pricing; account creation does not establish eligibility or a free verification allowance.

Never paste a secret key, BVN, banking password or customer account details into chat, a PR, browser code or a public Vercel setting.

## Read-only setup check

The new settings are used only by the lookup client and owner helper. They do not enable a registered bank-verification provider:

| Setting               | Test setup                                                |
| --------------------- | --------------------------------------------------------- |
| `PAYSTACK_MODE`       | `sandbox` (default); Paystack calls this Test Mode        |
| `PAYSTACK_SECRET_KEY` | The test **secret** key, stored privately on the API side |

The lookup origin is fixed to `https://api.paystack.co` in both modes; the secret key selects the Paystack environment. `live` requires a matching `sk_live_` key, but live lookup support is not production activation. Neither setting belongs in `NEXT_PUBLIC_*` variables. This work does not add the key to, read, or alter any private `.env` file.

### Check through Render logs, without paid Shell

Merge the `feat/paystack-render-check` follow-up and deploy the latest `main` commit on Render. Keep the existing build/start commands and the current `NODE_ENV=production`, `DEPLOYMENT_STAGE=staging` settings.

After the API opens its listening port, a configured staging process runs one background bank-catalogue check. It does not delay startup, repeat on a timer or change verification/financial eligibility. Unconfigured Paystack settings cause no request or log. Production-stage API processes do not run this automatic diagnostic.

In **Render → zetmond-wallet → Logs**, search for **`Paystack bank catalogue check:`** after the new deployment starts:

- A successful line includes `catalogueAvailable: true`, `mode: sandbox`, `country: NG`, a bank count, `duplicateEntryCount`, `excludedAmbiguousCodeCount` and `ownershipVerificationEnabled: false`. The disabled ownership flag is expected. Duplicate counts cover extra eligible entries sharing a code; the exclusion count covers distinct conflicting codes left unavailable.
- `authentication_failed` means Paystack returned HTTP 401 or 403; confirm the test secret and account's API access.
- `provider_unavailable` means the provider request failed, timed out or returned another non-200 status. `invalid_response` means its response failed the contract checks.
- The parser follow-up adds a fixed reason after `invalid_response`, such as `catalogue_bank_code`, `catalogue_shape`, `response_size` or `catalogue_cursor_repeated`. These are local diagnostic labels, never raw provider values. They help distinguish a field mismatch from an unreadable, oversized or inconsistent response.
- `catalogue_no_usable_banks` means no unambiguous active Nigerian bank remains after filtering. It never reports successful readiness from only conflicting entries.
- A configuration message names the fields to check without showing their values.

The diagnostic logs metadata and safe categories only. It never requests a customer account lookup or logs keys, holder names, BVNs, bank account numbers, raw provider errors or response bodies. Share only this safe diagnostic line for follow-up. A success does not establish account-resolution entitlement or completed ownership verification.

### Optional local owner check

Once the account is ready, put these settings in the API process's private environment. From the repository root:

```sh
pnpm --filter @zetmond/api build
pnpm --filter @zetmond/api paystack:check
```

The helper does not automatically load a file. For a local check using settings that **you** have already saved in `apps/api/.env`, Node can load that file for the helper:

```sh
node --env-file=apps/api/.env apps/api/dist/check-paystack.js
```

This is an optional owner command; the agent did not run it against a private file. A paid Render Shell is not required. Leave Render's existing API build/start commands in place.

A successful check prints only mode, country, currency, bank and aggregate duplicate/exclusion counts, `catalogueAvailable: true` and `ownershipVerificationEnabled: false`. It confirms a nonempty unambiguous Nigerian catalogue. It does not prove account-resolution entitlement, customer ownership, commercial eligibility or a completed Task 3. Errors use safe categories and omit provider messages, account details and credentials. Do not publish raw request traces containing authorization headers or account-number query strings.

## Implemented contract

The client uses Paystack's [official OpenAPI repository at `07c5abc`](https://github.com/PaystackOSS/openapi/tree/07c5abc8c34536e98a7755a5338178b4f430b09b). A [pinned contract extract](contracts/paystack-bank-lookups.openapi.json) and its [MIT license](contracts/paystack-openapi.LICENSE) are saved for review. The published website documentation was blocked by the workspace network policy; the public official GitHub specification was accessible.

| Operation                              | Implemented behavior                                                                                                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /bank`                            | Request Nigeria, NGN and NUBAN with cursor pagination; follow explicit `meta.next` when supplied and accept the published data-only response; keep only active, non-deleted Nigerian entries |
| `GET /bank/resolve`                    | Server-only account-name lookup; preserve leading zeros; check the returned account number and bank ID against the requested destination and current catalogue                               |
| `POST /customer/{code}/identification` | **Not called.** The source documents a BVN/bank-account identity check, but its HTTP 202 response only acknowledges acceptance                                                               |

Account and bank codes stay strings in Zetmond and in query parameters. Bank codes may contain letters and retain leading zeros; customer account numbers remain exactly ten digits. The source annotates resolution query values as integers; converting them to JavaScript numbers would discard meaningful leading zeros or reject letter-suffixed bank codes. Successful lookup responses must still return the exact requested account number. No vendor SDK or dependency was added.

The original client treated `perPage=100` as a maximum valid response size while disabling cursors, and required digit-only bank codes. Neither restriction is part of the pinned bank response schema: it defines an array without that page-size maximum and string bank codes. A synthetic 150-entry catalogue reproduced `invalid_response` before the correction. The corrected client follows explicit cursors instead of guessing offset pages and supports data-only responses independently of the requested page size. Optional `meta.next` is a compatibility extension; the pinned response schema itself does not specify cursor metadata. A missing cursor on a later cursor page, repeated cursor or exhausted page budget still fails without returning an incomplete pagination result. Bounds remain: 1 MiB per response, 1,000 catalogue records and ten pages. These are local resource limits, not claims about Paystack's catalogue size.

Repeated eligible records with the same code, provider ID and parsed name collapse into one listing, including repeats across cursor pages. If a code has conflicting provider IDs or names, it is excluded for the entire collected catalogue; later rows cannot restore it. Other unambiguous banks remain available. The owner check reports only aggregate counts, with no bank labels, codes or IDs. Attempting account resolution against an excluded code fails before requesting `/bank/resolve`. For an available code, the returned account number and single provider bank ID must still match exactly. The client never chooses between conflicting records or combines their IDs into an ownership approval.

The native transport uses server-only bearer authentication, validates bounded JSON, cancels timed-out requests, rejects redirects and returns sanitized failures. It retries no requests automatically. This does not establish Paystack's actual test-mode response behavior; account-backed checks remain necessary.

## Complete the ownership integration

Before connecting Paystack to the existing `/banks` approval flow:

1. Obtain the current **customer identification** result and webhook contracts, including authentication, canonical status recovery and exact customer/bank-account correlation. A generic customer `identified` flag or an accepted request is insufficient evidence for a particular destination.
2. Confirm the required BVN/customer fields, consent and retention rules. BVN collection is not added by this change and must never be invented from a document number or typed name.
3. Implement durable create/recover handling for the persisted operation, safe retries after uncertain outcomes, authenticated events and the provider's documented reconciliation rules. Preserve current MFA, encrypted details, destination fingerprint, KYC revision and matching-policy pins.
4. Demonstrate actual Test Mode approval, mismatch/rejection, duplicate and missing-event recovery, account/identity changes and unsupported-country rejection. A resolved name alone cannot satisfy these checks.
5. Register the adapter only after its evidence meets the existing ownership contract. Retain staging financial denial and the separate production launch requirements.

The account-setup step can proceed while code and contract work continue. Task 3 still also needs a completed Smile ID document/liveness/callback journey and bank-provider acceptance evidence.
