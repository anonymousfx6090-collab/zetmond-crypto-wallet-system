import { HttpException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { seal, unseal, digest, hash } from "../crypto";
import { Eligibility } from "../eligibility/eligibility";
import { countries, isSupportedCountry } from "../markets";
import {
  Country,
  Mode,
  VerificationProvider,
  currency,
  WebhookContext,
} from "../providers/verification";

export const fail = (message: string, status = 400): never => {
  throw new HttpException({ message }, status);
};
export const bankInput = z
  .object({
    operationId: z.string().uuid(),
    country: z.enum(countries),
    bankCode: z.string().trim().min(1).max(80),
    accountNumber: z.string().trim().min(4).max(40),
  })
  .strict();
export type BankInput = z.infer<typeof bankInput>;
export const bankDigest = (v: BankInput) =>
  hash(
    JSON.stringify([
      "bank_add",
      v.operationId,
      v.country,
      v.bankCode,
      v.accountNumber,
    ]),
  );
export const reasons: Record<string, string> = {
  document_unreadable:
    "Your document was not readable. Please capture it again.",
  document_expired: "Please use a current government-issued document.",
  identity_mismatch: "Your identity details need further review.",
  liveness_failed: "Please repeat the selfie and liveness check.",
  unsupported_document:
    "This document is not supported by the verification service.",
  review_required: "Your verification needs further review.",
  age_requirement: "You must be at least 18 to use Zetmond.",
  country_mismatch: "The verified country does not match your account country.",
  evidence_missing:
    "The verification service has not supplied all required checks.",
  ownership_mismatch:
    "The bank ownership check did not match your verified identity.",
};
export class VerificationService {
  readonly eligibility: Eligibility;
  constructor(
    readonly auth: AuthService,
    readonly providers: readonly VerificationProvider[],
  ) {
    this.eligibility = new Eligibility(auth);
    const ids = new Set<string>();
    for (const p of providers) {
      if (!/^[a-z0-9-]{1,50}$/.test(p.id) || ids.has(p.id))
        throw new Error("Invalid verification provider registry");
      ids.add(p.id);
      if (!p.disclosure.version || !p.disclosure.url.startsWith("https://"))
        throw new Error("Verification disclosure is required");
    }
  }
  get db() {
    return this.auth.db;
  }
  get key() {
    return this.auth.config.DATA_ENCRYPTION_KEY;
  }
  get mode(): Mode {
    return this.auth.config.NODE_ENV === "production" &&
      this.auth.config.DEPLOYMENT_STAGE === "production"
      ? "live"
      : "sandbox";
  }
  provider(kind: "identity" | "bank", country: Country) {
    return this.providers.find(
      (p) =>
        p.mode === this.mode &&
        (kind === "identity" ? p.identityCountries : p.bankCountries).includes(
          country,
        ),
    );
  }
  async enqueue(c: PoolClient, target: string, kind: string) {
    await c.query(
      `INSERT INTO verification_jobs(id,target_id,kind) VALUES($1,$2,$3)
      ON CONFLICT(target_id,kind) DO UPDATE SET generation=verification_jobs.generation+1,
      state=CASE WHEN verification_jobs.state='running' THEN 'running' ELSE 'queued' END,
      attempts=CASE WHEN verification_jobs.state='failed' THEN 0 ELSE verification_jobs.attempts END,run_at=now()`,
      [randomUUID(), target, kind],
    );
  }
  async currentAttempt(c: PoolClient, userId: string) {
    return (
      await c.query(
        `SELECT a.* FROM identity_cases k JOIN identity_attempts a ON a.id=k.current_attempt_id WHERE k.user_id=$1`,
        [userId],
      )
    ).rows[0];
  }
  async identityView(c: PoolClient, u: any) {
    const a = await this.currentAttempt(c, u.id),
      p = this.provider("identity", u.country);
    const providerMatches =
      !!p &&
      (!a ||
        (a.country === u.country && a.provider === p.id && a.mode === p.mode));
    let capture;
    if (
      u.email_verified &&
      a?.capture_payload &&
      a.status === "incomplete" &&
      providerMatches &&
      u.kyc_status !== "restricted"
    ) {
      const value = unseal<{ url: string; expiresAt: string }>(
        this.key,
        a.capture_payload,
      );
      if (new Date(value.expiresAt) > new Date()) capture = value;
    }
    const failed =
      a &&
      (
        await c.query(
          "SELECT 1 FROM verification_jobs WHERE target_id=$1 AND state='failed'",
          [a.id],
        )
      ).rowCount;
    return {
      status: a?.status || "not_started",
      attemptId: a?.id,
      reason: reasons[a?.reason],
      country: u.country,
      mode: this.mode,
      available: providerMatches,
      unavailableReason: providerMatches
        ? undefined
        : "Identity verification is not available in your country yet. Please check back later.",
      restricted: u.kyc_status === "restricted",
      emailVerified: u.email_verified,
      canStart:
        providerMatches &&
        u.email_verified &&
        u.kyc_status !== "restricted" &&
        !a,
      canResubmit:
        providerMatches &&
        u.email_verified &&
        u.kyc_status !== "restricted" &&
        a?.status === "correction_required",
      canRefresh:
        providerMatches &&
        u.email_verified &&
        u.kyc_status !== "restricted" &&
        !!a,
      capture,
      temporaryIssue: !!failed,
      disclosure: p?.disclosure,
      updatedAt: a?.updated_at,
      financialAccess: this.auth.view(u).financialAccess,
    };
  }
  identity(session?: string) {
    return this.db.tx(async (c) =>
      this.identityView(c, await this.eligibility.customer(c, session)),
    );
  }
  startIdentity(
    session: string | undefined,
    disclosureVersion: string,
    resubmit = false,
  ) {
    return this.db.tx(async (c) => {
      const u = await this.eligibility.customer(c, session);
      this.eligibility.identity(u);
      const p = this.provider("identity", u.country);
      if (!p)
        return fail("Identity verification is currently unavailable.", 503);
      if (disclosureVersion !== p.disclosure.version)
        return fail(
          "Review the current verification disclosure before continuing.",
        );
      const current = await this.currentAttempt(c, u.id);
      if (current && !resubmit) return this.identityView(c, u);
      if (resubmit && current?.status !== "correction_required")
        return fail("A new submission is not permitted for this case.", 409);
      const k = (
        await c.query(
          "INSERT INTO identity_cases(id,user_id) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET user_id=excluded.user_id RETURNING id",
          [randomUUID(), u.id],
        )
      ).rows[0];
      const id = randomUUID();
      await c.query(
        "INSERT INTO identity_attempts(id,case_id,provider,mode,country,status,disclosure_version,disclosure_url,consented_at) VALUES($1,$2,$3,$4,$5,'submitting',$6,$7,now())",
        [
          id,
          k.id,
          p.id,
          p.mode,
          u.country,
          p.disclosure.version,
          p.disclosure.url,
        ],
      );
      await c.query(
        "UPDATE identity_cases SET current_attempt_id=$2 WHERE id=$1",
        [k.id, id],
      );
      await c.query("UPDATE users SET kyc_status='pending' WHERE id=$1", [
        u.id,
      ]);
      await this.enqueue(c, id, "identity_start");
      await this.auth.audit(c, u.id, "identity_started", {
        attemptId: id,
        provider: p.id,
        mode: p.mode,
        disclosureVersion,
      });
      return this.identityView(c, { ...u, kyc_status: "pending" });
    });
  }
  refreshIdentity(session?: string) {
    return this.db.tx(async (c) => {
      const u = await this.eligibility.customer(c, session);
      this.eligibility.identity(u);
      const a = await this.currentAttempt(c, u.id);
      if (!a) return fail("Start identity verification first.", 409);
      const p = this.provider("identity", u.country);
      if (!p || p.id !== a.provider || p.mode !== a.mode)
        return fail("Identity verification is currently unavailable.", 503);
      await this.enqueue(
        c,
        a.id,
        a.status === "submitting" ? "identity_start" : "identity_sync",
      );
      return this.identityView(c, u);
    });
  }
  private async captureContext(session: string | undefined, attemptId: string) {
    return this.db.tx(async (c) => {
      const u = await this.eligibility.customer(c, session);
      this.eligibility.identity(u);
      const a = await this.currentAttempt(c, u.id);
      const p = this.provider("identity", u.country);
      if (
        !a ||
        a.id !== attemptId ||
        a.country !== u.country ||
        !p ||
        p.id !== a.provider ||
        p.mode !== a.mode
      )
        return fail("This verification session is no longer current.", 409);
      return {
        p,
        input: {
          operationId: a.id,
          userId: u.id,
          email: u.email,
          country: u.country,
        },
        status: a.status,
      };
    });
  }
  async browserCapture(session: string | undefined, attemptId: string) {
    const { p, input, status } = await this.captureContext(session, attemptId);
    if (!p.browserSession || status !== "incomplete")
      return fail(
        "Check your current verification status before continuing.",
        409,
      );
    if (!(await this.auth.rate(`identity-capture:${input.userId}`)))
      return fail(
        "Too many verification requests. Please try again later.",
        429,
      );
    const result = await p.browserSession(input);
    const current = await this.captureContext(session, attemptId);
    if (current.status !== "incomplete")
      return fail(
        "Your result is being processed. Check your verification status.",
        409,
      );
    return result;
  }
  async browserSubmission(
    session: string | undefined,
    body: { attemptId: string; jobId?: string; userId?: string },
  ) {
    const { p, input } = await this.captureContext(session, body.attemptId);
    if (!p.submissionHint)
      return fail("Submission tracking is unavailable.", 503);
    await p.submissionHint({
      ...input,
      jobId: body.jobId,
      providerUserId: body.userId,
    });
    await this.db.tx((c) =>
      this.enqueue(c, input.operationId, "identity_sync"),
    );
    return this.identity(session);
  }
  async banks(session?: string) {
    const result = await this.db.tx(async (c) => {
      const u = await this.eligibility.customer(c, session),
        p = this.provider("bank", u.country);
      const a = await this.currentAttempt(c, u.id);
      const rows = (
        await c.query(
          "SELECT id,bank_label,last_four,country,currency,status,reason,created_at,identity_attempt_id FROM bank_destinations WHERE user_id=$1 ORDER BY created_at DESC",
          [u.id],
        )
      ).rows;
      return {
        user: u,
        provider: p,
        view: {
          country: u.country,
          currency: currency[u.country as Country] ?? null,
          mode: this.mode,
          available: !!p,
          identityVerified:
            u.kyc_status === "approved" &&
            a?.status === "approved" &&
            a.country === u.country &&
            a.mode === this.mode,
          mfaEnabled: !!u.mfa_secret,
          emailVerified: u.email_verified,
          restricted: u.kyc_status === "restricted",
          destinations: rows.map((r) => ({
            id: r.id,
            bankName: r.bank_label,
            maskedAccount: `•••• ${r.last_four}`,
            country: r.country,
            currency: r.currency,
            status: r.status,
            reason: reasons[r.reason],
            usable:
              isSupportedCountry(u.country) &&
              isSupportedCountry(r.country) &&
              r.country === u.country &&
              r.status === "verified" &&
              r.identity_attempt_id === a?.id &&
              u.kyc_status === "approved",
            createdAt: r.created_at,
          })),
        },
      };
    });
    let banks: { code: string; name: string }[] = [],
      field;
    let available = !!result.provider;
    if (result.provider && result.view.identityVerified) {
      try {
        banks = await result.provider.banks(result.user.country);
        field = result.provider.bankField(result.user.country);
      } catch {
        available = false;
      }
    }
    return {
      ...result.view,
      available,
      banks,
      field,
      canAdd:
        available &&
        !!field &&
        result.view.identityVerified &&
        result.view.emailVerified &&
        result.view.mfaEnabled &&
        !result.view.restricted,
      unavailableReason: available
        ? undefined
        : "Bank verification is not available in your country right now. Please try again later.",
    };
  }
  async addBank(
    session: string | undefined,
    input: BankInput,
    stepUpId: string,
  ) {
    // Authentication before external lookup; all permissions are checked again inside the commit.
    const p = await this.db.tx(async (c) => {
      const u = await this.eligibility.customer(c, session);
      this.eligibility.bank(u);
      if (input.country !== u.country)
        return fail("Use a bank account in your registration country.");
      return (
        this.provider("bank", u.country) ||
        fail("Bank verification is currently unavailable.", 503)
      );
    });
    let list;
    try {
      list = await p.banks(input.country);
    } catch {
      return fail(
        "Bank verification is currently unavailable. Please retry safely.",
        503,
      );
    }
    const bank = list.find((v) => v.code === input.bankCode),
      field = p.bankField(input.country);
    if (
      !bank ||
      input.accountNumber.length < field.minLength ||
      input.accountNumber.length > field.maxLength ||
      !new RegExp(`^(?:${field.pattern})$`).test(input.accountNumber)
    )
      return fail("Check the selected bank and account details.");
    return this.db.tx(async (c) => {
      const u = await this.eligibility.customer(c, session);
      this.eligibility.bank(u);
      const a = await this.currentAttempt(c, u.id);
      if (
        !a ||
        a.status !== "approved" ||
        a.country !== u.country ||
        a.mode !== this.mode ||
        !a.evidence_payload
      )
        return fail("Current verified identity evidence is required.", 403);
      const operationDigest = bankDigest(input);
      const existing = (
        await c.query("SELECT * FROM bank_destinations WHERE id=$1", [
          input.operationId,
        ])
      ).rows[0];
      if (existing) {
        if (
          existing.user_id !== u.id ||
          existing.operation_digest !== digest(this.key, operationDigest)
        )
          return fail(
            "This operation cannot be reused with different details.",
            409,
          );
        return { id: existing.id, status: existing.status };
      }
      const fingerprint = digest(
        this.key,
        JSON.stringify([input.country, input.bankCode, input.accountNumber]),
      );
      if (
        (
          await c.query(
            "SELECT 1 FROM bank_destinations WHERE user_id=$1 AND account_fingerprint=$2",
            [u.id, fingerprint],
          )
        ).rowCount
      )
        return fail("This bank destination has already been added.", 409);
      const grant = await c.query(
        "UPDATE step_ups SET consumed_at=now() WHERE id=$1 AND session_id=$2 AND purpose='bank_add' AND operation_digest=$3 AND consumed_at IS NULL AND expires_at>now() RETURNING id",
        [stepUpId, u.session_id, digest(this.key, operationDigest)],
      );
      if (!grant.rowCount)
        return fail(
          "Fresh authenticator authorization for these exact bank details is required.",
          403,
        );
      await c.query(
        `INSERT INTO bank_destinations(id,user_id,identity_attempt_id,provider,mode,country,currency,details_payload,account_fingerprint,last_four,bank_label,operation_digest,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')`,
        [
          input.operationId,
          u.id,
          a.id,
          p.id,
          p.mode,
          input.country,
          currency[input.country],
          seal(this.key, {
            country: input.country,
            bankCode: input.bankCode,
            accountNumber: input.accountNumber,
          }),
          fingerprint,
          input.accountNumber.slice(-4),
          bank.name,
          digest(this.key, operationDigest),
        ],
      );
      await this.enqueue(c, input.operationId, "bank_start");
      await this.auth.audit(c, u.id, "bank_added", {
        destinationId: input.operationId,
        mode: p.mode,
      });
      return { id: input.operationId, status: "pending" };
    });
  }
  retryBank(session: string | undefined, id: string) {
    return this.db.tx(async (c) => {
      const u = await this.eligibility.customer(c, session);
      this.eligibility.bank(u);
      const b = (
        await c.query(
          "SELECT * FROM bank_destinations WHERE id=$1 AND user_id=$2",
          [id, u.id],
        )
      ).rows[0];
      if (!b) return fail("Bank account not found.", 404);
      const a = await this.currentAttempt(c, u.id),
        p = this.provider("bank", u.country);
      if (
        a?.id !== b.identity_attempt_id ||
        a?.status !== "approved" ||
        a.country !== u.country ||
        b.country !== u.country ||
        !isSupportedCountry(b.country)
      )
        return fail("The bank account needs a current verified identity.", 409);
      if (!p || p.id !== b.provider || p.mode !== b.mode)
        return fail("Bank verification is currently unavailable.", 503);
      if (b.status === "mismatch" || b.status === "inactive")
        return fail("This bank destination cannot be retried.", 409);
      await this.enqueue(c, id, b.revision < 0 ? "bank_start" : "bank_sync");
      return { id: b.id, status: b.status };
    });
  }
  async webhook(
    p: VerificationProvider,
    raw: Buffer,
    headers: Record<string, string | string[] | undefined>,
    context?: WebhookContext,
  ) {
    let event;
    try {
      event = z
        .object({
          eventId: z.string().min(1).max(200),
          operationId: z.string().uuid(),
          mode: z.enum(["sandbox", "live"]),
        })
        .strict()
        .parse(await p.authenticateWebhook(raw, headers, context));
    } catch {
      return fail("Invalid verification event.", 401);
    }
    if (event.mode !== p.mode || event.mode !== this.mode)
      return fail("Invalid verification event.", 401);
    await this.db.tx(async (c) => {
      const a = (
        await c.query(
          "SELECT provider,mode FROM identity_attempts WHERE id=$1",
          [event.operationId],
        )
      ).rows[0];
      const b = a
        ? null
        : (
            await c.query(
              "SELECT provider,mode FROM bank_destinations WHERE id=$1",
              [event.operationId],
            )
          ).rows[0];
      const target = a || b;
      if (!target || target.provider !== p.id || target.mode !== event.mode)
        return;
      if (p.persistWebhook)
        await p.persistWebhook(c, raw, headers, event, context);
      const inserted = await c.query(
        "INSERT INTO verification_events(provider,mode,event_id,target_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING event_id",
        [p.id, p.mode, event.eventId, event.operationId],
      );
      if (inserted.rowCount)
        await this.enqueue(
          c,
          event.operationId,
          a ? "identity_sync" : "bank_sync",
        );
    });
    return { received: true };
  }
}
