import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { digest, hash, seal, unseal } from "../crypto";
import { atomic } from "../money/amount";
import {
  TransferIntent,
  transferInput,
  SignedTransfer,
  CustodyPort,
  UnavailableCustody,
  CustodyUnavailableError,
} from "../custody/custody.port";
import {
  assertSignedEnvelope,
  assertSignedScope,
} from "../custody/signing-policy";
import { LedgerError, LedgerService } from "../ledger/ledger.service";
import { transferDigest } from "./intent";
export { transferDigest } from "./intent";
async function bounded<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      fn(controller.signal),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new CustodyUnavailableError());
        }, 10000);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
    controller.abort();
  }
}
export class FinancialOperations {
  readonly custody: CustodyPort;
  readonly recoveryOnly: boolean;
  constructor(
    readonly auth: AuthService,
    custody?: CustodyPort,
    options: { recoveryOnly?: boolean } = {},
  ) {
    this.recoveryOnly = options.recoveryOnly === true;
    const mode =
      auth.config.NODE_ENV === "production" &&
      auth.config.DEPLOYMENT_STAGE === "production"
        ? "live"
        : "sandbox";
    this.custody = custody || new UnavailableCustody(mode);
    if (
      this.custody.mode !== mode ||
      (this.custody.kind === "isolated" &&
        mode === "live" &&
        new URL(auth.config.DATABASE_URL).pathname.endsWith("_test")) ||
      (this.custody.kind === "fixture" &&
        (auth.config.NODE_ENV !== "test" ||
          !new URL(auth.config.DATABASE_URL).pathname.endsWith("_test")))
    )
      throw new Error("Invalid custody registry.");
  }
  get db() {
    return this.auth.db;
  }
  get key() {
    return this.auth.config.DATA_ENCRYPTION_KEY;
  }
  private async authorizeCreation(
    c: PoolClient,
    session: string | undefined,
    v: TransferIntent,
  ) {
    const user = await this.auth.current(c, session);
    if (
      !user ||
      !this.auth.view(user).financialAccess ||
      !user.mfa_secret ||
      Date.parse(v.expiresAt) <= Date.now()
    )
      throw new LedgerError("rejected");
    const asset = (
      await c.query("SELECT * FROM finance.asset_info($1)", [v.assetId])
    ).rows[0];
    if (
      !asset ||
      asset.mode !== v.mode ||
      asset.network !== v.network ||
      asset.contract_ref !== v.contract ||
      asset.decimals !== 6 ||
      asset.code !== (v.mode === "live" ? "USDT" : "USDT_TEST")
    )
      throw new LedgerError("rejected");
    const identity = (
      await c.query(
        "SELECT a.id,a.revision::text FROM identity_cases k JOIN identity_attempts a ON a.id=k.current_attempt_id WHERE k.user_id=$1 AND a.status='approved' AND a.mode=$2 AND a.country='NG' AND a.evidence_payload IS NOT NULL",
        [user.id, v.mode],
      )
    ).rows[0];
    if (
      !identity ||
      identity.id !== v.identityAttemptId ||
      identity.revision !== v.identityRevision
    )
      throw new LedgerError("rejected");
    return user;
  }
  async create(
    session: string | undefined,
    input: TransferIntent,
    stepUpId: string,
  ) {
    const p = transferInput.safeParse(input);
    if (!p.success || !z.string().uuid().safeParse(stepUpId).success)
      throw new LedgerError("invalid_request");
    const v = p.data;
    if (
      this.auth.config.DEPLOYMENT_STAGE === "staging" ||
      this.recoveryOnly ||
      !this.custody.ready() ||
      this.custody.mode !== v.mode
    )
      throw new CustodyUnavailableError();
    if (Date.parse(v.expiresAt) <= Date.now())
      throw new LedgerError("invalid_request");
    atomic((atomic(v.units) + atomic(v.feeUnits)).toString(), true);
    try {
      // Authenticate before any external work. Recheck after it, outside held DB locks.
      await this.db.tx((c) => this.authorizeCreation(c, session, v));
      await bounded((signal) => this.custody.authorizeIntent(v, signal));
      return await this.db.tx(async (c) => {
        const user = await this.authorizeCreation(c, session, v);
        const fingerprint = transferDigest(v);
        return (
          await c.query(
            "SELECT finance.prepare_operation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) AS id",
            [
              v.id,
              user.id,
              v.assetId,
              v.availableId,
              v.heldId,
              v.units,
              v.feeUnits,
              v.feeAccountId,
              fingerprint,
              seal(this.key, v),
              user.session_id,
              stepUpId,
              digest(this.key, fingerprint),
              v.identityAttemptId,
              v.identityRevision,
            ],
          )
        ).rows[0].id as string;
      });
    } catch {
      throw new LedgerError("rejected");
    }
  }
  async status(session: string | undefined, id: string) {
    if (!z.string().uuid().safeParse(id).success)
      throw new LedgerError("invalid_request");
    return this.db.tx(async (c) => {
      const user = await this.auth.current(c, session);
      if (!user || user.role !== "customer") throw new LedgerError("rejected");
      return (
        (
          await c.query("SELECT * FROM finance.operation_status($1,$2,$3)", [
            id,
            user.id,
            this.custody.mode,
          ])
        ).rows[0] || null
      );
    });
  }
  async balances(session: string | undefined) {
    return this.db.tx(async (c) => {
      const user = await this.auth.current(c, session);
      if (
        !user ||
        !this.auth.view(user).financialAccess ||
        this.auth.config.DEPLOYMENT_STAGE === "staging"
      )
        throw new LedgerError("rejected");
      return new LedgerService(this.db).balancesForCustomer(
        user.id,
        this.custody.mode,
        c,
      );
    });
  }
  private async valid(row: any, authorization = false) {
    return (
      await this.db.pool.query(
        "SELECT finance.operation_lease_valid($1,$2,$3) AS ok",
        [row.id, row.generation, authorization],
      )
    ).rows[0].ok as boolean;
  }
  private async update(
    row: any,
    state: string,
    signed?: SignedTransfer,
    evidence?: unknown,
  ) {
    return (
      await this.db.pool.query(
        "SELECT finance.update_operation($1,$2,$3,$4,$5,$6) AS ok",
        [
          row.id,
          row.generation,
          state,
          signed?.transactionRef || null,
          signed ? seal(this.key, signed) : null,
          evidence ? seal(this.key, evidence) : null,
        ],
      )
    ).rows[0].ok as boolean;
  }
  /** One recoverable operation; no public worker/approval route. */
  async dispatch(): Promise<boolean> {
    if (!this.custody.ready()) return false;
    const row = (
      await this.db.pool.query("SELECT * FROM finance.claim_operation($1)", [
        this.custody.mode,
      ])
    ).rows[0];
    if (!row) return false;
    try {
      const intent = transferInput.parse(unseal(this.key, row.intent_payload));
      if (
        intent.id !== row.id ||
        intent.assetId !== row.asset_id ||
        intent.mode !== this.custody.mode ||
        intent.identityAttemptId !== row.identity_attempt_id ||
        intent.identityRevision !== row.identity_revision ||
        transferDigest(intent) !== row.digest
      ) {
        await this.update(row, "review");
        return true;
      }
      let signed: SignedTransfer;
      if (row.state === "prepared") {
        if (this.recoveryOnly) return true;
        if (
          !(await this.valid(row, true)) ||
          Date.parse(intent.expiresAt) <= Date.now()
        ) {
          await this.update(row, "review");
          return true;
        }
        await bounded((signal) => this.custody.authorizeIntent(intent, signal));
        if (
          !(await this.valid(row, true)) ||
          Date.parse(intent.expiresAt) <= Date.now()
        ) {
          await this.update(row, "review");
          return true;
        }
        signed = await bounded((signal) =>
          this.custody.prepare(intent, signal),
        );
        assertSignedEnvelope(signed);
        assertSignedScope(
          intent,
          signed,
          await bounded((signal) => this.custody.decode(signed, signal)),
        );
        if (!(await this.update(row, "signed", signed))) return true;
      } else signed = unseal<SignedTransfer>(this.key, row.signed_payload);
      assertSignedEnvelope(signed);
      assertSignedScope(
        intent,
        signed,
        await bounded((signal) => this.custody.decode(signed, signal)),
      );
      const result = await bounded((signal) =>
        this.custody.lookup(signed, signal),
      );
      if (
        result.transactionRef !== signed.transactionRef ||
        !result.evidenceRef ||
        result.evidenceRef.length > 250
      ) {
        await this.update(row, "review");
        return true;
      }
      assertSignedScope(intent, signed, result.decoded);
      if (result.state === "confirmed" || result.state === "failed_final") {
        await this.db.pool.query(
          "SELECT finance.finish_operation($1,$2,$3,$4,$5)",
          [
            row.id,
            row.generation,
            result.state === "confirmed" ? "complete" : "failed",
            result.state === "confirmed"
              ? intent.custodyAccountId
              : intent.availableId,
            seal(this.key, result),
          ],
        );
      } else if (result.state === "pending")
        await this.update(row, "confirming", undefined, result);
      else if (result.state === "conflict")
        await this.update(row, "review", undefined, result);
      else if (result.state === "not_found") {
        if (
          Date.parse(intent.expiresAt) > Date.now() &&
          !this.recoveryOnly &&
          (await this.valid(row, true)) &&
          (row.state === "prepared" ||
            row.state === "signed" ||
            this.custody.canRebroadcastSameTransaction)
        ) {
          await bounded((signal) =>
            this.custody.authorizeIntent(intent, signal),
          );
          if (
            !(await this.valid(row, true)) ||
            Date.parse(intent.expiresAt) <= Date.now()
          ) {
            await this.update(row, "review");
            return true;
          }
          if (!(await this.update(row, "unknown", undefined, result)))
            return true;
          await bounded((signal) => this.custody.broadcast(signed, signal));
          await this.update(row, "submitted");
        } else await this.update(row, "unknown", undefined, result);
      } else await this.update(row, "review");
    } catch {
      // Errors and custody responses may contain addresses, payloads and credentials.
      // Retain the persisted signature/hold and resolve through canonical lookup.
    } finally {
      await this.db.pool.query("SELECT finance.defer_operation($1,$2)", [
        row.id,
        row.generation,
      ]);
    }
    return true;
  }
  async receiveEvent(
    raw: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ) {
    if (!Buffer.isBuffer(raw) || raw.length > 65536 || !this.custody.ready())
      throw new CustodyUnavailableError();
    const event = await bounded((signal) =>
      this.custody.authenticateEvent(raw, headers, signal),
    );
    if (
      event.mode !== this.custody.mode ||
      !event.eventRef ||
      event.eventRef.length > 250
    )
      throw new LedgerError("rejected");
    return (
      await this.db.pool.query(
        "SELECT finance.record_event($1,$2,$3,$4,$5,$6) AS state",
        [
          randomUUID(),
          event.mode,
          this.custody.providerId,
          event.eventRef,
          hash(raw.toString("base64")),
          seal(this.key, { raw: raw.toString("base64") }),
        ],
      )
    ).rows[0].state as string;
  }
  async reconcile() {
    if (!this.custody.ready()) throw new CustodyUnavailableError();
    const observations = await bounded((signal) =>
      this.custody.positions(signal),
    );
    if (observations.some((v) => !v.evidenceRef || v.evidenceRef.length > 250))
      throw new LedgerError("rejected");
    return (
      await this.db.pool.query(
        "SELECT finance.reconcile($1,$2::jsonb,$3) AS result",
        [
          this.custody.mode,
          JSON.stringify(
            observations.map((v) => ({
              accountId: v.accountId,
              units: v.units,
            })),
          ),
          seal(this.key, observations),
        ],
      )
    ).rows[0].result;
  }
}
