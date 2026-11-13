import { createHash } from "node:crypto";
import { z } from "zod";
import tron from "tronweb/utils";
import { atomic } from "../money/amount";
import { transferDigest } from "../financial-operations/intent";
import { SignedTransfer, transferInput, TransferIntent } from "./custody.port";
import { assertSignedEnvelope } from "./signing-policy";
import { validTronAddress } from "./tron-address";

const { address, crypto, transaction } = tron;

const hex = (bytes: number) =>
  z.string().regex(new RegExp(`^[a-f0-9]{${bytes * 2}}$`, "i"));
const positiveUnits = z.string().refine((v) => {
  try {
    return atomic(v, true) <= BigInt(Number.MAX_SAFE_INTEGER);
  } catch {
    return false;
  }
});
const tronAddress = z.string().refine(validTronAddress);
const instant = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
/** Server-owned policy and authenticated, persisted network reference.
 * TRON addresses/raw transactions do not identify a network by themselves.
 * Never construct this context from a browser or from labels in signed.payload.
 */
export const tronSigningContext = z
  .object({
    mode: z.enum(["sandbox", "live"]),
    network: z.enum(["tron-mainnet", "tron-nile", "tron-shasta"]),
    sender: tronAddress,
    contract: tronAddress,
    keyRef: z.string().min(1).max(200),
    policyVersion: z.string().min(1).max(80),
    intentDigest: hex(32),
    maxFeeLimitSun: positiveUnits,
    maxLifetimeMs: instant,
    maxReferenceAgeMs: instant,
    block: z
      .object({
        refBlockBytes: hex(2),
        refBlockHash: hex(8),
        timestamp: instant,
        evidenceRef: z.string().min(1).max(250),
      })
      .strict(),
  })
  .strict()
  .refine((v) => (v.mode === "live") === (v.network === "tron-mainnet"));
export type TronSigningContext = z.infer<typeof tronSigningContext>;

const contract = z
  .object({
    parameter: z
      .object({
        type_url: z.literal(
          "type.googleapis.com/protocol.TriggerSmartContract",
        ),
        value: z
          .object({
            owner_address: z.string().regex(/^41[a-f0-9]{40}$/i),
            contract_address: z.string().regex(/^41[a-f0-9]{40}$/i),
            data: hex(68),
            call_value: z.literal(0).optional(),
            call_token_value: z.literal(0).optional(),
            token_id: z.literal(0).optional(),
          })
          .strict(),
      })
      .strict(),
    type: z.literal("TriggerSmartContract"),
    Permission_id: z.literal(0).optional(),
  })
  .strict();
const signedTransaction = z
  .object({
    txID: hex(32),
    raw_data_hex: z
      .string()
      .min(2)
      .max(8192)
      .regex(/^(?:[a-f0-9]{2})+$/i),
    raw_data: z
      .object({
        contract: z.array(contract).length(1),
        ref_block_bytes: hex(2),
        ref_block_hash: hex(8),
        expiration: instant,
        timestamp: instant,
        fee_limit: instant,
        data: z.literal("").optional(),
      })
      .strict(),
    signature: z
      .array(z.string().regex(/^[a-f0-9]{128}(?:00|01|1b|1c)$/i))
      .length(1),
    visible: z.literal(false).optional(),
  })
  .strict();

export class TronTransferValidationError extends Error {
  constructor() {
    super("TRON transfer validation failed.");
  }
}
export type VerifiedTronTransfer = {
  transactionRef: string;
  sender: string;
  destination: string;
  contract: string;
  units: string;
  feeLimitSun: string;
  expiresAt: string;
};

/** Offline verification only: no RPC, keys, signing, posting or broadcast.
 * Opaque operation/quote/identity IDs are bound in the persisted intent, not
 * invented as decoded chain fields. The caller must retain that trusted join.
 */
export function verifyTronTransfer(
  signed: SignedTransfer,
  intent: TransferIntent,
  context: TronSigningContext,
): VerifiedTronTransfer {
  try {
    assertSignedEnvelope(signed);
    if (Buffer.byteLength(signed.payload, "utf8") > 32768)
      throw new TronTransferValidationError();
    const v = transferInput.parse(intent),
      p = tronSigningContext.parse(context);
    const tx = signedTransaction.parse(JSON.parse(signed.payload));
    const raw = tx.raw_data,
      call = raw.contract[0].parameter.value;
    const txId = createHash("sha256")
      .update(Buffer.from(tx.raw_data_hex, "hex"))
      .digest("hex");
    // Canonical reserialization rejects omitted/extra contracts, unknown protobuf
    // fields and contradictions between JSON and the bytes actually signed.
    if (
      txId !== signed.transactionRef ||
      tx.txID.toLowerCase() !== txId ||
      !transaction.txCheck(tx)
    )
      throw new TronTransferValidationError();
    if (
      p.intentDigest.toLowerCase() !== transferDigest(v) ||
      p.mode !== v.mode ||
      p.network !== v.network ||
      p.contract !== v.contract ||
      p.keyRef !== v.keyRef ||
      p.policyVersion !== v.policyVersion
    )
      throw new TronTransferValidationError();
    const senderHex = address.toHex(p.sender).toLowerCase();
    if (
      call.owner_address.toLowerCase() !== senderHex ||
      call.contract_address.toLowerCase() !==
        address.toHex(v.contract).toLowerCase()
    )
      throw new TronTransferValidationError();
    const data = call.data.toLowerCase();
    // transfer(address,uint256), canonical ABI address padding, one exact amount.
    if (
      data.slice(0, 8) !== "a9059cbb" ||
      data.slice(8, 32) !== "0".repeat(24) ||
      data.slice(32, 72) !==
        address.toHex(v.destination).slice(2).toLowerCase() ||
      BigInt("0x" + data.slice(72)).toString() !== v.units
    )
      throw new TronTransferValidationError();
    if (
      raw.ref_block_bytes.toLowerCase() !==
        p.block.refBlockBytes.toLowerCase() ||
      raw.ref_block_hash.toLowerCase() !== p.block.refBlockHash.toLowerCase() ||
      raw.timestamp < p.block.timestamp ||
      raw.timestamp - p.block.timestamp > p.maxReferenceAgeMs
    )
      throw new TronTransferValidationError();
    if (
      raw.expiration !== Date.parse(v.expiresAt) ||
      raw.expiration <= raw.timestamp ||
      raw.expiration - raw.timestamp > p.maxLifetimeMs ||
      BigInt(raw.fee_limit) > atomic(p.maxFeeLimitSun, true)
    )
      throw new TronTransferValidationError();
    // Recover from the real transaction hash and signature, not a provider flag.
    if (crypto.ecRecover(txId, tx.signature[0]).toLowerCase() !== senderHex)
      throw new TronTransferValidationError();
    return {
      transactionRef: txId,
      sender: p.sender,
      destination: v.destination,
      contract: v.contract,
      units: v.units,
      feeLimitSun: String(raw.fee_limit),
      expiresAt: v.expiresAt,
    };
  } catch {
    // Provider payloads may contain customer data: never expose parser messages.
    throw new TronTransferValidationError();
  }
}
