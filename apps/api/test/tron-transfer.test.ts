import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHash,
  createECDH,
  createPublicKey,
  randomUUID,
  verify,
} from "node:crypto";
import tron from "tronweb/utils";
import type {
  TransferIntent,
  SignedTransfer,
} from "../src/custody/custody.port";
import { transferDigest } from "../src/financial-operations/intent";
import {
  verifyTronTransfer,
  TronSigningContext,
  TronTransferValidationError,
} from "../src/custody/tron-transfer";

const { address, crypto, transaction } = tron;

// Public, deliberately insecure fixture key 1. Never used by application code.
const fixtureKey = Buffer.from("0".repeat(63) + "1", "hex");
const secondKey = Buffer.from("0".repeat(63) + "2", "hex");
const sender = crypto.getBase58CheckAddress(
  crypto.getAddressFromPriKey(fixtureKey),
);
const receiver = crypto.getBase58CheckAddress(
  crypto.getAddressFromPriKey(secondKey),
);
const timestamp = Date.UTC(2026, 10, 12);
function vector() {
  const intent: TransferIntent = {
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
    destination: receiver,
    keyRef: "fixture-key-reference",
    units: "9007199254740993123456",
    feeUnits: "10000",
    quoteId: randomUUID(),
    policyVersion: "fixture-policy",
    expiresAt: new Date(timestamp + 60000).toISOString(),
  };
  const context: TronSigningContext = {
    mode: intent.mode,
    network: intent.network,
    sender,
    contract: intent.contract,
    keyRef: intent.keyRef,
    policyVersion: intent.policyVersion,
    intentDigest: transferDigest(intent),
    maxFeeLimitSun: "50000000",
    maxLifetimeMs: 60000,
    maxReferenceAgeMs: 60000,
    block: {
      refBlockBytes: "babe",
      refBlockHash: "1122334455667788",
      timestamp: timestamp - 1000,
      evidenceRef: "controlled-fixture-block",
    },
  };
  const tx = {
    txID: "",
    raw_data_hex: "",
    signature: [] as string[],
    visible: false,
    raw_data: {
      contract: [
        {
          parameter: {
            type_url: "type.googleapis.com/protocol.TriggerSmartContract",
            value: {
              owner_address: address.toHex(sender),
              contract_address: address.toHex(intent.contract),
              data:
                "a9059cbb" +
                address.toHex(receiver).slice(2).padStart(64, "0") +
                BigInt(intent.units).toString(16).padStart(64, "0"),
              call_value: 0,
            },
          },
          type: "TriggerSmartContract",
          Permission_id: 0,
        },
      ],
      ref_block_bytes: context.block.refBlockBytes,
      ref_block_hash: context.block.refBlockHash,
      timestamp,
      expiration: timestamp + 60000,
      fee_limit: 30000000,
    },
  };
  resign(tx);
  return {
    intent,
    context,
    tx,
    signed: () => ({ transactionRef: tx.txID, payload: JSON.stringify(tx) }),
  };
}
function signRaw(tx: any, key = fixtureKey) {
  tx.txID = createHash("sha256")
    .update(Buffer.from(tx.raw_data_hex, "hex"))
    .digest("hex");
  tx.signature = [crypto.ECKeySign(Buffer.from(tx.txID, "hex"), key)];
}
function resign(tx: any, key = fixtureKey) {
  tx.raw_data_hex = transaction
    .txPbToRawDataHex(transaction.txJsonToPb(tx))
    .toLowerCase();
  signRaw(tx, key);
}
function rejects(
  v: ReturnType<typeof vector>,
  signed: SignedTransfer = v.signed(),
  context: TronSigningContext = v.context,
  intent: TransferIntent = v.intent,
) {
  assert.throws(
    () => verifyTronTransfer(signed, intent, context),
    (error) =>
      error instanceof TronTransferValidationError &&
      error.message === "TRON transfer validation failed.",
  );
}

test("real TRON protobuf bytes, SHA-256 transaction ID and recoverable ECDSA signature verify offline", () => {
  const v = vector(),
    proof = verifyTronTransfer(v.signed(), v.intent, v.context);
  assert.equal(proof.units, "9007199254740993123456");
  assert.equal(proof.sender, sender);
  assert.equal(proof.destination, receiver);
  assert.equal(proof.feeLimitSun, "30000000");
  // Independent Node/OpenSSL verification checks the SDK-generated vector too.
  const ec = createECDH("secp256k1");
  ec.setPrivateKey(fixtureKey);
  const publicKey = createPublicKey({
    key: Buffer.concat([
      Buffer.from("3056301006072a8648ce3d020106052b8104000a034200", "hex"),
      ec.getPublicKey(undefined, "uncompressed"),
    ]),
    format: "der",
    type: "spki",
  });
  assert.equal(
    verify(
      "sha256",
      Buffer.from(v.tx.raw_data_hex, "hex"),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(v.tx.signature[0].slice(0, 128), "hex"),
    ),
    true,
  );
});
test("transaction JSON, the envelope reference and the actual signed bytes must agree", () => {
  const v = vector();
  v.tx.raw_data.contract[0].parameter.value.data =
    v.tx.raw_data.contract[0].parameter.value.data.slice(0, -1) + "f";
  rejects(v);
  const original = vector();
  rejects(original, { ...original.signed(), transactionRef: "f".repeat(64) });
  original.tx.txID = "f".repeat(64);
  rejects(original);
});
test("signed recipient, amount, contract and transfer method cannot differ from the approved intent", () => {
  for (const field of [
    "recipient",
    "amount",
    "contract",
    "method",
    "padding",
  ]) {
    const v = vector(),
      call = v.tx.raw_data.contract[0].parameter.value;
    if (field === "recipient")
      call.data =
        "a9059cbb" +
        address.toHex(sender).slice(2).padStart(64, "0") +
        BigInt(v.intent.units).toString(16).padStart(64, "0");
    if (field === "amount")
      call.data = call.data.slice(0, 72) + "1".padStart(64, "0");
    if (field === "contract") call.contract_address = address.toHex(sender);
    if (field === "method") call.data = "095ea7b3" + call.data.slice(8); // approve(), never transfer()
    if (field === "padding")
      call.data = call.data.slice(0, 8) + "1" + call.data.slice(9);
    resign(v.tx);
    rejects(v);
  }
});
test("provider success labels do not replace a valid signature by the pinned source wallet", () => {
  const v = vector();
  signRaw(v.tx, secondKey);
  rejects(v);
  const invalid = vector();
  invalid.tx.signature = ["0".repeat(128) + "1b"];
  rejects(invalid);
  const claimed = vector();
  rejects(claimed, {
    ...claimed.signed(),
    payload: JSON.stringify({ ...claimed.tx, signatureValid: true }),
  });
  const missing = vector();
  missing.tx.signature = [];
  rejects(missing);
  const multiple = vector();
  multiple.tx.signature.push(multiple.tx.signature[0]);
  rejects(multiple);
});
test("opaque operation, quote, fee and identity context must match its saved authorization digest", () => {
  const v = vector();
  for (const key of [
    "id",
    "quoteId",
    "feeAccountId",
    "custodyAccountId",
    "identityAttemptId",
    "policyVersion",
    "keyRef",
  ] as const)
    rejects(v, v.signed(), v.context, { ...v.intent, [key]: randomUUID() });
  rejects(v, v.signed(), v.context, { ...v.intent, feeUnits: "10001" });
  rejects(v, v.signed(), { ...v.context, intentDigest: "f".repeat(64) });
});
test("TRON network binding requires the persisted authenticated block reference", () => {
  const v = vector();
  rejects(v, v.signed(), { ...v.context, network: "tron-shasta" });
  rejects(v, v.signed(), { ...v.context, mode: "live" });
  rejects(v, v.signed(), {
    ...v.context,
    block: { ...v.context.block, refBlockHash: "f".repeat(16) },
  });
  rejects(v, v.signed(), {
    ...v.context,
    block: { ...v.context.block, refBlockBytes: "ffff" },
  });
  rejects(v, v.signed(), {
    ...v.context,
    block: { ...v.context.block, evidenceRef: "" },
  });
  rejects(v, v.signed(), {
    ...v.context,
    block: { ...v.context.block, timestamp: timestamp + 1 },
  });
  rejects(v, v.signed(), { ...v.context, maxReferenceAgeMs: 999 });
});
test("TRX fee limits and transaction lifetime are exact bounded policy values", () => {
  for (const field of ["fee", "expiry", "lifetime"]) {
    const v = vector();
    if (field === "fee") v.tx.raw_data.fee_limit = 50000001;
    if (field === "expiry") v.tx.raw_data.expiration += 1;
    if (field === "lifetime") v.tx.raw_data.timestamp -= 1;
    resign(v.tx);
    rejects(v);
  }
  const v = vector();
  rejects(v, v.signed(), { ...v.context, maxFeeLimitSun: "0" });
  // Historical signed transactions remain decodable during canonical recovery.
  assert.doesNotThrow(() =>
    verifyTronTransfer(v.signed(), v.intent, v.context),
  );
});
test("TRX/TRC-10 side payments, permission changes, memos and extra contracts are excluded", () => {
  for (const field of ["call_value", "call_token_value", "token_id"]) {
    const v = vector();
    (v.tx.raw_data.contract[0].parameter.value as any)[field] = 1;
    resign(v.tx);
    rejects(v);
  }
  const permission = vector();
  permission.tx.raw_data.contract[0].Permission_id = 2;
  resign(permission.tx);
  rejects(permission);
  const multi = vector();
  multi.tx.raw_data.contract.push(multi.tx.raw_data.contract[0]);
  resign(multi.tx);
  rejects(multi);
  const memo = vector();
  (memo.tx.raw_data as any).data = "deadbeef";
  resign(memo.tx);
  rejects(memo);
});
test("unknown protobuf fields and additional binary contracts cannot hide behind clean JSON", () => {
  const unknown = vector();
  unknown.tx.raw_data_hex += "980601";
  signRaw(unknown.tx);
  rejects(unknown);
  const multi = vector(),
    pb = transaction.txJsonToPb(multi.tx),
    raw = pb.getRawData();
  raw.addContract(raw.getContractList()[0]);
  multi.tx.raw_data_hex = transaction.txPbToRawDataHex(pb);
  signRaw(multi.tx);
  rejects(multi);
});
test("malformed, oversized and unsafe-integer input fails without exposing signed payloads", () => {
  const v = vector();
  for (const payload of [
    "not-json",
    "null",
    "[]",
    "x".repeat(32769),
    JSON.stringify({
      ...v.tx,
      raw_data: { ...v.tx.raw_data, timestamp: Number.MAX_SAFE_INTEGER + 1 },
    }),
  ])
    rejects(v, { ...v.signed(), payload });
  rejects(v, v.signed(), { ...v.context, maxFeeLimitSun: "1.5" });
  rejects(v, v.signed(), { ...v.context, sender: "bad-address" });
});
