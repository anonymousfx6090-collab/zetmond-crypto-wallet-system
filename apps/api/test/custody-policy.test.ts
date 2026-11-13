import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  transferInput,
  TransferIntent,
  DecodedTransfer,
} from "../src/custody/custody.port";
import {
  assertSignedEnvelope,
  assertSignedScope,
} from "../src/custody/signing-policy";
import { transferDigest } from "../src/financial-operations/operations.service";
function intent(): TransferIntent {
  return {
    id: randomUUID(),
    assetId: randomUUID(),
    availableId: randomUUID(),
    heldId: randomUUID(),
    feeAccountId: randomUUID(),
    custodyAccountId: randomUUID(),
    identityAttemptId: randomUUID(),
    identityRevision: "1",
    mode: "sandbox",
    network: "tron-nile",
    contract: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
    destination: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
    keyRef: "fixture",
    units: "1",
    feeUnits: "0",
    quoteId: randomUUID(),
    policyVersion: "fixture",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };
}
test("transfer grants bind fees, identity, asset, destination, accounts, network and expiry", () => {
  const v = intent(),
    baseline = transferDigest(v);
  for (const key of Object.keys(v) as (keyof TransferIntent)[]) {
    assert.notEqual(
      transferDigest({
        ...v,
        [key]: String(v[key]) + "changed",
      } as TransferIntent),
      baseline,
      key,
    );
  }
  assert.equal(transferInput.safeParse({ ...v, mode: "live" }).success, false);
  assert.equal(
    transferInput.safeParse({ ...v, network: "tron-mainnet" }).success,
    false,
  );
  assert.equal(
    transferInput.safeParse({ ...v, privateKey: "never" }).success,
    false,
  );
  assert.equal(transferInput.safeParse({ ...v, units: 1 }).success, false);
});
test("signed bytes require a bounded envelope and exact decoded scope including transaction hash", () => {
  const v = intent(),
    signed = {
      transactionRef: "a".repeat(64),
      payload: "fixture signed bytes",
    };
  const decoded: DecodedTransfer = {
    transactionRef: signed.transactionRef,
    operationId: v.id,
    mode: v.mode,
    network: v.network,
    contract: v.contract,
    destination: v.destination,
    units: v.units,
    keyRef: v.keyRef,
    policyVersion: v.policyVersion,
    expiresAt: v.expiresAt,
    signatureValid: true,
  };
  assert.doesNotThrow(() => assertSignedScope(v, signed, decoded));
  for (const key of Object.keys(decoded) as (keyof DecodedTransfer)[])
    assert.throws(() =>
      assertSignedScope(v, signed, {
        ...decoded,
        [key]: key === "signatureValid" ? false : "changed",
      }),
    );
  assert.throws(() =>
    assertSignedEnvelope({ ...signed, payload: "x".repeat(1024 * 1024 + 1) }),
  );
  assert.throws(() =>
    assertSignedEnvelope({ ...signed, transactionRef: "bad" }),
  );
});
