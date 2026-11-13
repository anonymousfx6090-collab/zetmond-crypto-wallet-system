import { z } from "zod";
import { atomic } from "../money/amount";
import { validTronAddress } from "./tron-address";

const units = z.string().refine((v) => {
  try {
    atomic(v);
    return true;
  } catch {
    return false;
  }
});
export const transferInput = z
  .object({
    id: z.string().uuid(),
    assetId: z.string().uuid(),
    availableId: z.string().uuid(),
    heldId: z.string().uuid(),
    feeAccountId: z.string().uuid(),
    custodyAccountId: z.string().uuid(),
    identityAttemptId: z.string().uuid(),
    identityRevision: z.string().regex(/^(0|[1-9][0-9]{0,18})$/),
    mode: z.enum(["sandbox", "live"]),
    network: z.enum(["tron-mainnet", "tron-nile", "tron-shasta"]),
    contract: z.string().refine(validTronAddress),
    destination: z.string().refine(validTronAddress),
    keyRef: z.string().min(1).max(200),
    units: units.refine((v) => atomic(v) > 0n),
    feeUnits: units,
    quoteId: z.string().uuid(),
    policyVersion: z.string().min(1).max(80),
    expiresAt: z.string().datetime(),
  })
  .strict()
  .refine((v) => (v.mode === "live") === (v.network === "tron-mainnet"));
export type TransferIntent = z.infer<typeof transferInput>;
export type SignedTransfer = { transactionRef: string; payload: string };
export type DecodedTransfer = {
  transactionRef: string;
  operationId: string;
  mode: "sandbox" | "live";
  network: string;
  contract: string;
  destination: string;
  units: string;
  keyRef: string;
  policyVersion: string;
  expiresAt: string;
  signatureValid: boolean;
};
export type CustodyStatus = {
  state: "not_found" | "pending" | "confirmed" | "failed_final" | "conflict";
  transactionRef: string;
  decoded: DecodedTransfer;
  evidenceRef: string;
};
/** Real implementations must decode actual signed bytes and independently authenticate
 * canonical status. A JSON label or caller-supplied success is never evidence.
 * prepare is idempotent and MUST NOT broadcast. broadcast accepts persisted bytes only.
 */
export interface CustodyPort {
  readonly kind: "isolated" | "fixture" | "unavailable";
  readonly mode: "sandbox" | "live";
  readonly providerId: string;
  readonly canRebroadcastSameTransaction: boolean;
  ready(): boolean;
  /** Read-only independent quote/limit/key/asset policy check; never signs or submits. */
  authorizeIntent(intent: TransferIntent, signal: AbortSignal): Promise<void>;
  prepare(intent: TransferIntent, signal: AbortSignal): Promise<SignedTransfer>;
  decode(signed: SignedTransfer, signal: AbortSignal): Promise<DecodedTransfer>;
  lookup(signed: SignedTransfer, signal: AbortSignal): Promise<CustodyStatus>;
  broadcast(signed: SignedTransfer, signal: AbortSignal): Promise<void>;
  authenticateEvent(
    raw: Buffer,
    headers: Record<string, string | string[] | undefined>,
    signal: AbortSignal,
  ): Promise<{ eventRef: string; mode: "sandbox" | "live" }>;
  positions(
    signal: AbortSignal,
  ): Promise<{ accountId: string; units: string; evidenceRef: string }[]>;
}
export class CustodyUnavailableError extends Error {
  constructor() {
    super("Protected custody integration is unavailable.");
  }
}
export class UnavailableCustody implements CustodyPort {
  readonly kind = "unavailable";
  readonly providerId = "unconfigured";
  readonly canRebroadcastSameTransaction = false;
  constructor(readonly mode: "sandbox" | "live") {}
  ready() {
    return false;
  }
  async authorizeIntent(): Promise<void> {
    throw new CustodyUnavailableError();
  }
  async prepare(): Promise<SignedTransfer> {
    throw new CustodyUnavailableError();
  }
  async decode(): Promise<DecodedTransfer> {
    throw new CustodyUnavailableError();
  }
  async lookup(): Promise<CustodyStatus> {
    throw new CustodyUnavailableError();
  }
  async broadcast(): Promise<void> {
    throw new CustodyUnavailableError();
  }
  async authenticateEvent(): Promise<{
    eventRef: string;
    mode: "sandbox" | "live";
  }> {
    throw new CustodyUnavailableError();
  }
  async positions(): Promise<
    { accountId: string; units: string; evidenceRef: string }[]
  > {
    throw new CustodyUnavailableError();
  }
}
