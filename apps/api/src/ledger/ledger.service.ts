import { PoolClient } from "pg";
import { z } from "zod";
import { Database } from "../db";
import { atomic } from "../money/amount";

export const modeSchema = z.enum(["sandbox", "live"]);
const uuid = z.string().uuid();
const units = z.string().refine((v) => {
  try {
    atomic(v, true);
    return true;
  } catch {
    return false;
  }
});
export const journalInput = z
  .object({
    id: uuid,
    assetId: uuid,
    operationId: uuid,
    key: z.string().min(1).max(150),
    kind: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/),
    legs: z
      .array(
        z
          .object({ accountId: uuid, side: z.enum(["debit", "credit"]), units })
          .strict(),
      )
      .min(2)
      .max(100),
    reversesId: uuid.optional(),
  })
  .strict();
export type JournalInput = z.infer<typeof journalInput>;
export class LedgerError extends Error {
  constructor(readonly code: "invalid_request" | "rejected") {
    super(`Financial operation ${code}.`);
  }
}
const accountInput = z
  .object({
    id: uuid,
    assetId: uuid,
    ownerId: uuid.nullable(),
    purpose: z.enum([
      "available",
      "trade_held",
      "collateral_held",
      "withdrawal_held",
      "custody",
      "clearing",
      "unmatched",
      "payout",
      "refund",
      "fee_liability",
      "revenue",
      "expense",
      "equity",
    ]),
    normalSide: z.enum(["debit", "credit"]),
    nonnegative: z.boolean(),
  })
  .strict();

/** Internal accounting only. Never expose arbitrary posting legs through HTTP. */
export class LedgerService {
  constructor(readonly db: Database) {}
  async createAccount(input: z.infer<typeof accountInput>, c?: PoolClient) {
    const v = accountInput.safeParse(input);
    if (!v.success) throw new LedgerError("invalid_request");
    try {
      const a = v.data;
      return (
        await (c || this.db.pool).query(
          "SELECT finance.create_account($1,$2,$3,$4,$5,$6) AS id",
          [a.id, a.assetId, a.ownerId, a.purpose, a.normalSide, a.nonnegative],
        )
      ).rows[0].id as string;
    } catch {
      throw new LedgerError("rejected");
    }
  }
  async post(input: JournalInput, c?: PoolClient) {
    const v = journalInput.safeParse(input);
    if (!v.success) throw new LedgerError("invalid_request");
    try {
      const j = v.data;
      return (
        await (c || this.db.pool).query(
          "SELECT finance.post($1,$2,$3,$4,$5,$6::jsonb,$7) AS id",
          [
            j.id,
            j.assetId,
            j.operationId,
            j.key,
            j.kind,
            JSON.stringify(j.legs),
            j.reversesId || null,
          ],
        )
      ).rows[0].id as string;
    } catch {
      throw new LedgerError("rejected");
    }
  }
  async reserve(
    input: {
      id: string;
      actionId: string;
      availableId: string;
      heldId: string;
      units: string;
      expiresAt?: string;
    },
    c?: PoolClient,
  ) {
    const v = z
      .object({
        id: uuid,
        actionId: uuid,
        availableId: uuid,
        heldId: uuid,
        units,
        expiresAt: z.string().datetime().optional(),
      })
      .strict()
      .safeParse(input);
    if (!v.success) throw new LedgerError("invalid_request");
    try {
      const h = v.data;
      return (
        await (c || this.db.pool).query(
          "SELECT finance.reserve($1,$2,$3,$4,$5,$6) AS id",
          [
            h.id,
            h.actionId,
            h.availableId,
            h.heldId,
            h.units,
            h.expiresAt || null,
          ],
        )
      ).rows[0].id as string;
    } catch {
      throw new LedgerError("rejected");
    }
  }
  async finishHold(
    input: {
      id: string;
      actionId: string;
      action: "release" | "consume";
      units: string;
      destinationId: string;
    },
    c?: PoolClient,
  ) {
    const v = z
      .object({
        id: uuid,
        actionId: uuid,
        action: z.enum(["release", "consume"]),
        units,
        destinationId: uuid,
      })
      .strict()
      .safeParse(input);
    if (!v.success) throw new LedgerError("invalid_request");
    try {
      const h = v.data;
      return (
        await (c || this.db.pool).query(
          "SELECT finance.finish_hold($1,$2,$3,$4,$5) AS id",
          [h.id, h.actionId, h.action, h.units, h.destinationId],
        )
      ).rows[0].id as string;
    } catch {
      throw new LedgerError("rejected");
    }
  }
  async balancesForCustomer(
    customerId: string,
    mode: "sandbox" | "live",
    c?: PoolClient,
  ) {
    if (
      !uuid.safeParse(customerId).success ||
      !modeSchema.safeParse(mode).success
    )
      throw new LedgerError("invalid_request");
    try {
      return (
        await (c || this.db.pool).query(
          "SELECT * FROM finance.read_balances($1,$2)",
          [customerId, mode],
        )
      ).rows as {
        account_id: string;
        asset_id: string;
        code: string;
        network: string;
        purpose: string;
        units: string;
        version: string;
        spending_paused: boolean;
      }[];
    } catch {
      throw new LedgerError("rejected");
    }
  }
}
