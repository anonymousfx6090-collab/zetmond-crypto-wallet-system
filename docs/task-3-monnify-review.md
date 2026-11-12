# Monnify evaluation for Task 3

**Historical evaluation:** the owner subsequently selected Paystack for Nigerian bank integration. See [Paystack setup and current status](paystack-setup.md). The findings below remain research and do not activate Monnify.

Evaluated 11 November 2026. Monnify is a candidate for **Nigeria/NGN bank
verification**. Smile ID remains the selected document/selfie KYC provider.
Nigeria is the only enabled launch market. Ghana/GHS and Kenya/KES are deferred
and show “Zetmond is not available in your country yet”; their integration can
follow later. The inspected sources do not establish their bank coverage. No vendor account,
paid service, credentials, payment or production capability was activated.

## Vendor-published evidence

The following npm archives were downloaded, their registry integrity hashes
verified, and source inspected without installing or executing vendor code:

| Source                                                                                                                                                                                                           | Evidence                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`monnify-nodejs-lib` 3.0.0](https://www.npmjs.com/package/monnify-nodejs-lib/v/3.0.0), [source revision `213f25b`](https://github.com/Monnify/Monnify-Nodejs-lib/tree/213f25becf5e9a0aff98337973b24adcd6e36e84) | Bank-account validation, BVN-details matching, and BVN/account matching are separate operations. The SDK takes account numbers and bank codes as strings.                                                                       |
| [`@monnify/mcp-server` 1.0.1](https://www.npmjs.com/package/@monnify/mcp-server/v/1.0.1), [source revision `6d7b4ef`](https://github.com/Monnify/mcp-server/tree/6d7b4ef10c9acaa40ed5353d183a96335b44aa82)       | Bank-list and account-validation descriptions explicitly say **Nigerian** banks/accounts. Generated types include BVN/account match states. This server was inspected as API documentation, not installed as an app capability. |

The account-validation result contains `accountNumber`, `accountName` and
`bankCode`. It establishes a provider-confirmed bank name, not consent, control,
an identity match or permission for Zetmond's business by itself. Never convert
identifiers to JavaScript numbers or infer ownership from a browser callback.

The Node SDK exposes `POST /api/v1/vas/bvn-account-match` with `bvn`,
`accountNumber` and `bankCode`. The generated response schema describes `bvn`,
`accountNumber`, `accountName`, `matchStatus` (`FULL_MATCH` or `NO_MATCH`) and
`matchPercentage`. An authenticated BVN/account association, combined with
independently verified BVN details matching the current Smile ID identity, is a
candidate ownership-evidence chain to validate. A customer-supplied BVN alone
must not establish that identity link.

## Contract gaps before integration

1. Resolve an endpoint-version discrepancy: the Node SDK uses
   `GET /api/v1/disbursements/account/validate`; the MCP tool uses
   `GET /api/v2/disbursements/account/validate`. Confirm the current official
   contract and enabled account capability before choosing a route. Do not try
   both automatically or send customer data to guessed endpoints.
2. Confirm authenticated response fields, failure/partial-match semantics,
   billing/retry behavior and any result-recovery operation. A timeout must not
   silently trigger another chargeable verification.
3. Confirm how the customer's verified BVN details bind to the current Smile ID
   name/date of birth and exact bank account. Additional data/consent must be
   justified by the chosen service rather than collected speculatively.
4. Confirm sandbox capabilities. The MCP README says its BVN/NIN identity checks
   are live-only and do not succeed in sandbox. That statement does not establish
   the separate BVN/account-match operation's sandbox support. Do not claim local
   fixtures are real sandbox acceptance or test real identities in production
   just to obtain a passing check.
5. Confirm Monnify accepts Zetmond's disclosed custodial crypto/P2P business for
   the intended service, its fees and onboarding requirements. A bank-verification
   approval does not authorize collection accounts, transfers or Vault settlement.
6. Revisit proven Ghana/Kenya coverage when those countries are enabled later.
   They are not part of the initial Nigeria-only integration.

## Next provider step

Use the official [Monnify site](https://monnify.com/) to review account/onboarding
requirements and obtain developer access. Obtain the current verification API
specification plus approved test cases/account capabilities. Put any credentials
in protected service settings; never paste keys, BVNs or bank details into chat.

Task 3's provider-neutral renewal flow can be tested locally while this evaluation
continues. Actual Monnify authentication, bank validation, BVN evidence and
country-specific acceptance remain unproven; no Monnify adapter is enabled.
