import { hash } from "../crypto";
import type { TransferIntent } from "../custody/custody.port";

/** Stable v1 authorization scope. Preserve ordering for already-issued grants. */
export const transferDigest = (v: TransferIntent) =>
  hash(
    JSON.stringify([
      "withdrawal-v1",
      v.id,
      v.assetId,
      v.availableId,
      v.heldId,
      v.feeAccountId,
      v.custodyAccountId,
      v.identityAttemptId,
      v.identityRevision,
      v.mode,
      v.network,
      v.contract,
      v.destination,
      v.keyRef,
      v.units,
      v.feeUnits,
      v.quoteId,
      v.policyVersion,
      v.expiresAt,
    ]),
  );
