import { randomUUID } from "node:crypto";
import { seal, unseal } from "../crypto";
import { adult, bankResult, identityResult } from "../providers/verification";
import { VerificationService } from "./verification.service";
import { isSupportedCountry } from "../markets";
import {
  bankNamePolicyVersion,
  bankPoliciesCurrent,
  compareBankOwnerNames,
  bankIdentityCurrent,
} from "./bank-ownership-policy";

/** PostgreSQL is authoritative. Leases fence crashed workers; provider calls use the persisted
 * operation ID. This pump can be woken by BullMQ without putting customer evidence in Redis.
 */
async function deadline<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Verification provider timeout")),
          30000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export class VerificationWorker {
  constructor(private service: VerificationService) {}
  async dispatch() {
    const s = this.service;
    const job = await s.db.tx(async (c) => {
      const row = (
        await c.query(
          `SELECT * FROM verification_jobs WHERE (state='queued' AND run_at<=now()) OR (state='running' AND lease_until<=now()) ORDER BY run_at LIMIT 1 FOR UPDATE SKIP LOCKED`,
        )
      ).rows[0];
      if (!row) return null;
      row.lease_token = randomUUID();
      await c.query(
        "UPDATE verification_jobs SET state='running',lease_token=$2,lease_until=now()+interval '2 minutes' WHERE id=$1",
        [row.id, row.lease_token],
      );
      return row;
    });
    if (!job) {
      for (const p of s.providers)
        if (
          p.mode === s.mode &&
          p.dispatchRecovery &&
          (await p.dispatchRecovery())
        )
          return true;
      return false;
    }
    try {
      const identity = job.kind.startsWith("identity");
      const target = identity
        ? (
            await s.db.pool.query(
              "SELECT a.*,k.user_id FROM identity_attempts a JOIN identity_cases k ON k.id=a.case_id WHERE a.id=$1",
              [job.target_id],
            )
          ).rows[0]
        : (
            await s.db.pool.query(
              "SELECT * FROM bank_destinations WHERE id=$1",
              [job.target_id],
            )
          ).rows[0];
      if (!target) {
        await s.db.pool.query(
          "UPDATE verification_jobs SET state='done',lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2",
          [job.id, job.lease_token],
        );
        return true;
      }
      const p = s.providers.find(
        (p) =>
          p.id === target.provider &&
          p.mode === target.mode &&
          p.mode === s.mode,
      );
      if (!p) throw new Error("Provider unavailable");
      // Prevent stale work from initiating new provider operations after restriction or resubmission.
      const allowed = await s.db.tx(async (c) => {
        const u = (
          await c.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [
            target.user_id,
          ])
        ).rows[0];
        const a = await s.currentAttempt(c, u.id);
        return (
          isSupportedCountry(u.country) &&
          isSupportedCountry(target.country) &&
          target.country === u.country &&
          !u.restricted &&
          u.email_verified &&
          u.kyc_status !== "restricted" &&
          (identity
            ? a?.id === target.id
            : u.kyc_status === "approved" &&
              bankIdentityCurrent(target, a) &&
              a?.status === "approved" &&
              a.country === u.country &&
              a.mode === s.mode &&
              !!a.evidence_payload &&
              !["inactive", "mismatch"].includes(target.status))
        );
      });
      if (!allowed) {
        await this.finish(job);
        return true;
      }
      if (!identity && !bankPoliciesCurrent(target, p.bankPolicyVersion)) {
        await this.reviewBankPolicy(job, target, p.bankPolicyVersion);
        return true;
      }
      let raw;
      if (identity)
        raw =
          job.kind === "identity_start"
            ? await deadline(
                p.identityStart({
                  operationId: target.id,
                  country: target.country,
                  returnUrl: `${s.auth.config.APP_ORIGIN}/identity`,
                }),
              )
            : await deadline(p.identityStatus(target.id));
      else {
        const a = (
          await s.db.pool.query(
            "SELECT evidence_payload FROM identity_attempts WHERE id=$1",
            [target.identity_attempt_id],
          )
        ).rows[0];
        raw =
          job.kind === "bank_start"
            ? await deadline(
                p.bankStart({
                  operationId: target.id,
                  details: unseal(s.key, target.details_payload),
                  accountFingerprint: target.account_fingerprint,
                  identityAttemptId: target.identity_attempt_id,
                  identity: unseal(s.key, a.evidence_payload),
                }),
              )
            : await deadline(p.bankStatus(target.id));
      }
      const result = identity
        ? identityResult.parse(raw)
        : bankResult.parse(raw);
      if (result.operationId !== target.id || result.mode !== target.mode)
        throw new Error("Unbound provider result");
      if (identity && "capture" in result && result.capture) {
        const url = new URL(result.capture.url);
        if (
          (url.protocol !== "https:" &&
            !(
              s.auth.config.NODE_ENV !== "production" &&
              url.origin === s.auth.config.APP_ORIGIN &&
              ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
              url.protocol === "http:"
            )) ||
          url.username ||
          url.password ||
          !p.captureOrigins.includes(url.origin)
        )
          throw new Error("Invalid capture origin");
      }
      await s.db.tx(async (c) => {
        const u = (
          await c.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [
            target.user_id,
          ])
        ).rows[0];
        const a = await s.currentAttempt(c, u.id);
        const current = (
          await c.query(
            `SELECT * FROM ${identity ? "identity_attempts" : "bank_destinations"} WHERE id=$1 FOR UPDATE`,
            [target.id],
          )
        ).rows[0];
        const lease = (
          await c.query(
            "SELECT * FROM verification_jobs WHERE id=$1 FOR UPDATE",
            [job.id],
          )
        ).rows[0];
        if (
          lease.lease_token !== job.lease_token ||
          new Date(lease.lease_until) <= new Date()
        )
          return;
        const eligible =
          isSupportedCountry(u.country) &&
          isSupportedCountry(target.country) &&
          target.country === u.country &&
          !u.restricted &&
          u.email_verified &&
          u.kyc_status !== "restricted" &&
          (identity
            ? a?.id === target.id
            : u.kyc_status === "approved" &&
              bankIdentityCurrent(current, a) &&
              a?.status === "approved" &&
              a.country === u.country &&
              a.mode === s.mode &&
              !!a.evidence_payload);
        let pending = false;
        if (eligible && result.revision > Number(current.revision)) {
          if (identity) {
            const r = identityResult.parse(result);
            let status = r.status,
              reason = r.reason as string | undefined;
            if (status === "approved") {
              if (!r.evidence) {
                status = "under_review";
                reason = "evidence_missing";
              } else if (r.evidence.country !== u.country) {
                status = "rejected";
                reason = "country_mismatch";
              } else if (!adult(r.evidence.dateOfBirth)) {
                status = "rejected";
                reason = "age_requirement";
              }
            }
            // Corrections/rejections require a new attempt. A late approval cannot resurrect one.
            if (
              ["correction_required", "rejected"].includes(current.status) &&
              status !== current.status
            ) {
              await this.finishIn(c, job, lease);
              return;
            }
            await c.query(
              "UPDATE identity_attempts SET status=$2,revision=$3,reason=$4,capture_payload=$5,evidence_payload=$6,updated_at=now() WHERE id=$1",
              [
                target.id,
                status,
                r.revision,
                reason || null,
                status === "incomplete" && r.capture
                  ? seal(s.key, r.capture)
                  : null,
                status === "approved" && r.evidence
                  ? seal(s.key, r.evidence)
                  : null,
              ],
            );
            await c.query("UPDATE users SET kyc_status=$2 WHERE id=$1", [
              u.id,
              status === "approved" ? "approved" : "pending",
            ]);
            await c.query(
              "INSERT INTO verification_decisions(user_id,target_id,kind,revision,status,reason) VALUES($1,$2,'identity',$3,$4,$5)",
              [u.id, target.id, r.revision, status, reason || null],
            );
            await s.auth.audit(c, u.id, "identity_decision", {
              attemptId: target.id,
              status,
              revision: r.revision,
            });
            pending = ["incomplete", "under_review"].includes(status);
          } else {
            const r = bankResult.parse(result);
            let status = r.status,
              reason;
            if (
              status === "verified" &&
              !bankPoliciesCurrent(current, p.bankPolicyVersion)
            ) {
              status = "under_review";
              reason = "ownership_policy_changed";
            }
            if (
              status === "verified" &&
              (!r.evidence ||
                r.evidence.accountFingerprint !== current.account_fingerprint ||
                r.evidence.identityAttemptId !== current.identity_attempt_id ||
                r.evidence.policyVersion !== current.provider_policy_version)
            ) {
              status = "mismatch";
              reason = "ownership_mismatch";
            }
            if (status === "verified") {
              const identityEvidence = unseal<
                NonNullable<
                  import("../providers/verification").IdentityResult["evidence"]
                >
              >(s.key, a.evidence_payload);
              if (
                compareBankOwnerNames(
                  identityEvidence?.legalName,
                  r.evidence?.ownerName,
                ) !== "match"
              ) {
                status = "under_review";
                reason = "owner_name_review";
              }
            }
            if (["inactive", "mismatch"].includes(current.status)) {
              await this.finishIn(c, job, lease);
              return;
            }
            if (status === "mismatch") reason = "ownership_mismatch";
            await c.query(
              "UPDATE bank_destinations SET status=$2,revision=$3,reason=$4,evidence_payload=$5,updated_at=now() WHERE id=$1",
              [
                target.id,
                status,
                r.revision,
                reason || null,
                ["verified", "under_review"].includes(status) && r.evidence
                  ? seal(s.key, r.evidence)
                  : null,
              ],
            );
            await c.query(
              "INSERT INTO verification_decisions(user_id,target_id,kind,revision,status,reason) VALUES($1,$2,'bank',$3,$4,$5)",
              [u.id, target.id, r.revision, status, reason || null],
            );
            await s.auth.audit(c, u.id, "bank_decision", {
              destinationId: target.id,
              status,
              revision: r.revision,
            });
            pending = status === "pending";
          }
        } else if (eligible)
          pending = identity
            ? ["incomplete", "under_review"].includes(current.status)
            : current.status === "pending";
        await this.finishIn(c, job, lease);
        if (pending) {
          const kind = identity ? "identity_sync" : "bank_sync";
          // Polling recovers missed callbacks. Never postpone a webhook that is already queued.
          await c.query(
            `INSERT INTO verification_jobs(id,target_id,kind,run_at) VALUES($1,$2,$3,now()+interval '1 minute') ON CONFLICT(target_id,kind) DO UPDATE SET state='queued',run_at=now()+interval '1 minute' WHERE verification_jobs.state='done'`,
            [randomUUID(), target.id, kind],
          );
        }
      });
    } catch {
      await s.db.pool.query(
        `UPDATE verification_jobs SET attempts=attempts+1,state=CASE WHEN attempts>=7 THEN 'failed' ELSE 'queued' END,lease_token=NULL,lease_until=NULL,run_at=now()+make_interval(secs=>least(300,5*power(2,least(attempts,6)))::int) WHERE id=$1 AND lease_token=$2`,
        [job.id, job.lease_token],
      );
      console.warn(
        "Verification provider operation unavailable; retained for safe retry.",
      );
    }
    return true;
  }
  private async reviewBankPolicy(
    job: any,
    target: any,
    providerVersion: string,
  ) {
    const s = this.service;
    await s.db.tx(async (c) => {
      const u = (
        await c.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [
          target.user_id,
        ])
      ).rows[0];
      const a = u && (await s.currentAttempt(c, u.id));
      const current = (
        await c.query(
          "SELECT * FROM bank_destinations WHERE id=$1 FOR UPDATE",
          [target.id],
        )
      ).rows[0];
      const lease = (
        await c.query(
          "SELECT * FROM verification_jobs WHERE id=$1 FOR UPDATE",
          [job.id],
        )
      ).rows[0];
      if (
        !lease ||
        lease.lease_token !== job.lease_token ||
        new Date(lease.lease_until) <= new Date()
      )
        return;
      if (
        u &&
        current &&
        !u.restricted &&
        u.email_verified &&
        u.kyc_status === "approved" &&
        isSupportedCountry(u.country) &&
        current.country === u.country &&
        bankIdentityCurrent(current, a) &&
        a?.status === "approved" &&
        a.country === u.country &&
        a.mode === s.mode &&
        !!a.evidence_payload &&
        current.mode === s.mode &&
        !["inactive", "mismatch"].includes(current.status) &&
        !bankPoliciesCurrent(current, providerVersion) &&
        (current.status !== "under_review" ||
          current.reason !== "ownership_policy_changed")
      ) {
        // This local hold does not invent or advance a provider revision.
        await c.query(
          "UPDATE bank_destinations SET status='under_review',reason='ownership_policy_changed',updated_at=now() WHERE id=$1",
          [current.id],
        );
        await s.auth.audit(c, u.id, "bank_policy_review", {
          destinationId: current.id,
          providerPolicyVersion: providerVersion,
          namePolicyVersion: bankNamePolicyVersion,
        });
      }
      await this.finishIn(c, job, lease);
    });
  }
  private async finish(job: any) {
    await this.service.db.tx(async (c) => {
      const lease = (
        await c.query(
          "SELECT * FROM verification_jobs WHERE id=$1 FOR UPDATE",
          [job.id],
        )
      ).rows[0];
      if (lease?.lease_token === job.lease_token)
        await this.finishIn(c, job, lease);
    });
  }
  private async finishIn(c: import("pg").PoolClient, job: any, lease: any) {
    await c.query(
      "UPDATE verification_jobs SET state=$2,attempts=0,lease_token=NULL,lease_until=NULL WHERE id=$1",
      [job.id, lease.generation === job.generation ? "done" : "queued"],
    );
  }
}
