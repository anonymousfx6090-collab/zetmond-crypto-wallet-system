import {
  TransferIntent,
  DecodedTransfer,
  SignedTransfer,
} from "./custody.port";

export function assertSignedEnvelope(signed: SignedTransfer) {
  if (
    !signed ||
    typeof signed.transactionRef !== "string" ||
    !/^[a-f0-9]{64}$/.test(signed.transactionRef) ||
    typeof signed.payload !== "string" ||
    signed.payload.length < 1 ||
    Buffer.byteLength(signed.payload, "utf8") > 1024 * 1024
  )
    throw new Error("Signed transfer validation failed.");
}
export function assertSignedScope(
  intent: TransferIntent,
  signed: SignedTransfer,
  decoded: DecodedTransfer,
) {
  assertSignedEnvelope(signed);
  if (
    !decoded ||
    decoded.transactionRef !== signed.transactionRef ||
    decoded.signatureValid !== true
  )
    throw new Error("Signed transfer validation failed.");
  const expected = {
    operationId: intent.id,
    mode: intent.mode,
    network: intent.network,
    contract: intent.contract,
    destination: intent.destination,
    units: intent.units,
    keyRef: intent.keyRef,
    policyVersion: intent.policyVersion,
    expiresAt: intent.expiresAt,
  };
  for (const key of Object.keys(expected) as (keyof typeof expected)[])
    if (decoded[key] !== expected[key])
      throw new Error("Signed transfer scope mismatch.");
}
