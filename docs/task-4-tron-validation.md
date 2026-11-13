# Task 4 — TRON transaction verification

The accounting foundation was merged in PR #17. This continuation adds an offline verifier for the actual bytes and signatures of a single TRC-20 transfer. It does not sign, create a wallet, call a provider, broadcast, post money or enable customer financial features. Dfns account access and real custody acceptance remain outstanding.

## Implemented boundary

`apps/api/src/custody/tron-transfer.ts` exports `verifyTronTransfer(signed, intent, context)` for the future protected custody adapter. The adapter must pass the saved signed transaction, the original authorized intent and a trusted, persisted `TronSigningContext`.

The verifier checks:

- The transaction ID equals SHA-256 of the real protobuf `raw_data_hex`. Canonical reserialization must match exactly; contradictory JSON, hidden binary contracts and unknown protobuf fields fail.
- The only operation is `TriggerSmartContract` calling `transfer(address,uint256)`, with the exact approved contract, recipient and positive atomic units. Amounts above JavaScript's integer precision remain exact.
- The ECDSA signature actually recovers the pinned source wallet. A provider's `signatureValid` or success label cannot substitute for a valid signature.
- The complete intent digest matches the saved authorization, including customer account references, identity revision, quote, fees, operation ID and policy version. The existing v1 digest order is preserved; the original module still re-exports it for compatibility.
- The signed expiry equals the authorized expiry. Lifetime, reference age and the actual TRX `fee_limit` stay within explicitly supplied policy bounds. There is no default fee budget or invented production limit.
- The TRON reference block matches the saved reference for the configured network. TRON addresses and unsigned network labels alone cannot identify mainnet versus Nile/Shasta.

The initial supported transaction form has one owner-key signature and one contract. Multisignature permissions, TRX/TRC-10 side payments, approvals, arbitrary calls, memos and additional contracts are rejected. Supporting another form requires its own reviewed policy and tests.

The returned `VerifiedTronTransfer` contains checked native transfer fields. It does not pretend that internal customer, quote, identity or operation IDs are decoded from the blockchain; those remain joined through the protected intent digest and saved context. Historical transactions remain decodable during recovery. The financial worker separately checks expiry/current authority before new signing or broadcasting.

## Trusted context requirements

The context is server-owned input. Obtain its source wallet, key reference, supported token and limits from reviewed configuration and the provider's authenticated wallet evidence. Obtain the reference block and its timestamp from the authenticated RPC for that specific network. Persist the evidence reference and context with the protected signing operation before any broadcast.

An `evidenceRef` string alone does not authenticate a block. This verifier validates the saved context against the signed bytes; it does not fetch or attest the RPC evidence. Never build the context from browser fields, provider transaction labels or an untrusted callback. The real adapter still needs independent policy enforcement, quote authorization, authenticated canonical status/finality and durable signing-request recovery.

Example internal use:

```ts
const nativeTransfer = verifyTronTransfer(
  savedSignedTransaction,
  savedAuthorizedIntent,
  savedAuthenticatedSigningContext,
);
```

The module is not registered as a public API or enabled custody provider. `UnavailableCustody` remains the application default.

## Runtime and dependencies

The verifier uses the official [`tronweb` 6.5.2 package](https://www.npmjs.com/package/tronweb/v/6.5.2), pinned in the API dependency and lockfile. Its protobuf serializer and ECDSA recovery are used without instantiating an RPC client. The package was inspected after checking its published SHA-512 integrity. No vendor installation scripts were enabled for local validation.

This version declares Node `^22.23.4 || ^24.22.1 || >=26.12.1`. Use a compatible runtime; local validation used an isolated Node 24.22.1 binary verified against Node.js's official SHA-256 manifest. Render's previously reported Node 24.22.1 meets this requirement; hosted settings were not changed. The GitHub workflow already requests the latest Node 24.

There are no new environment variables or migrations. The private `.env` was not read or modified. Existing financial intents retain their v1 authorization digest and encrypted storage format.

## Dfns sandbox next steps

1. Obtain Dfns sandbox access and confirm plan/pricing and Zetmond's eligibility before buying anything. No account or paid service was created from this chat.
2. Confirm TRON Nile support and a Zetmond-controlled custodial wallet in that environment. A test token must be registered separately from production USDT.
3. Provision a narrowly scoped service identity for the isolated custody service. Confirm the supported transaction-signing flow, independently enforced policy and same-operation lookup/recovery. Do not give the customer browser custody credentials or broad raw-hash signing access.
4. Connect the provider and authenticated TRON RPC, capture the real reference block and fee/resource estimate, then exercise signing, actual signed-byte verification, broadcast, lost-response recovery and reconciliation on Nile.
5. Record real evidence before enabling custody. Passing offline tests does not establish key protection, provider availability, canonical finality or a completed test-network transfer.

Only account-access status or provider names should be shared in chat. Keep access tokens, private credentials and recovery material in the appropriate protected service settings.

## Validation

All **224 API tests passed**, including 10 new TRON validation cases. The API TypeScript build and customer Next.js production build passed using Node 24.22.1. Existing authentication, verification, ledger and recovery tests ran against disposable PostgreSQL/Redis services. UI routes were not changed.

The offline suite covers actual TRON-format protobuf bytes and recoverable signatures, an independent Node/OpenSSL verification of the positive vector, exact large amounts, payload/hash contradictions, changed recipients/units/contracts/methods, wrong signers, authorization-digest mismatches, wrong reference blocks, fee/expiry bounds, side payments, extra binary contracts and malformed/oversized input.

The vectors use deliberately public fixture keys and controlled block references. No network transaction or provider acceptance is claimed.
