import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import nodemailer from "nodemailer";
import { Database } from "../db";
import { Config } from "../config";
import { seal, unseal } from "../crypto";
import { deliveryFailure, deliveryFailureCode } from "./failure";
export type Message = { to: string; subject: string; text: string };
export class Delivery {
  constructor(
    private db: Database,
    private config: Config,
  ) {}
  async enqueue(
    c: PoolClient,
    userId: string,
    channel: "email",
    message: Message,
    expiresAt?: Date,
    challengeId?: string,
  ) {
    await c.query(
      "INSERT INTO delivery_outbox(id,user_id,channel,payload,expires_at,challenge_id) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        userId,
        channel,
        seal(this.config.DATA_ENCRYPTION_KEY, message),
        expiresAt || null,
        challengeId || null,
      ],
    );
  }
  async dispatch() {
    await this.db.pool.query(
      `WITH stale AS (
        SELECT o.id, CASE WHEN o.expires_at<=clock_timestamp() OR ch.expires_at<=clock_timestamp()
          THEN 'expired' ELSE 'cancelled' END AS status
        FROM delivery_outbox o LEFT JOIN challenges ch ON ch.id=o.challenge_id
        WHERE o.status IN ('queued','failed') AND (
          o.expires_at<=clock_timestamp() OR (o.challenge_id IS NOT NULL AND (
            ch.consumed_at IS NOT NULL OR ch.expires_at<=clock_timestamp()
            OR ch.attempts>=$1 OR ch.user_id<>o.user_id)))
        FOR UPDATE OF o SKIP LOCKED
      ) UPDATE delivery_outbox o SET status=stale.status,payload=''
        FROM stale WHERE o.id=stale.id`,
      [this.config.CHALLENGE_ATTEMPTS],
    );
    if (this.config.DELIVERY_MODE === "development") return; // Encrypted local outbox; never expose a debug API.
    const due = await this.db.pool.query(
      `SELECT id FROM delivery_outbox WHERE channel='email' AND status='queued'
       AND next_attempt_at<=clock_timestamp() AND (expires_at IS NULL OR expires_at>clock_timestamp())
       LIMIT 5`,
    );
    // Do not open five transactions every second when the queue is empty.
    if (!due.rows.length) return;
    // Each message commits separately. A slow recipient must not hold up the whole batch,
    // and a later database error must not roll back messages already accepted by SMTP.
    const results = await Promise.allSettled(
      Array.from({ length: due.rows.length }, () => this.dispatchOne()),
    );
    const accepted = results.filter(
      (r) => r.status === "fulfilled" && r.value === "accepted",
    ).length;
    if (accepted)
      console.info(`Email delivery: ${accepted} message(s) accepted by SMTP.`);
    // Wait for every in-flight send before allowing the pump or shutdown to proceed.
    const failure = results.find((r) => r.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }
  private async dispatchOne() {
    return this.db.tx(async (c) => {
      const row = (
        await c.query(
          `SELECT o.* FROM delivery_outbox o LEFT JOIN challenges ch ON ch.id=o.challenge_id
           WHERE o.channel='email' AND o.status='queued' AND o.next_attempt_at<=clock_timestamp()
           AND (o.expires_at IS NULL OR o.expires_at>clock_timestamp())
           AND (o.challenge_id IS NULL OR (ch.consumed_at IS NULL
             AND ch.expires_at>clock_timestamp() AND ch.attempts<$1 AND ch.user_id=o.user_id))
           ORDER BY o.created_at LIMIT 1 FOR UPDATE OF o SKIP LOCKED`,
          [this.config.CHALLENGE_ATTEMPTS],
        )
      ).rows[0];
      if (!row) return;
      try {
        const m = unseal<Message>(this.config.DATA_ENCRYPTION_KEY, row.payload);
        if (!this.config.SMTP_HOST || !this.config.MAIL_FROM)
          throw new Error("Email not configured");
        const transport = nodemailer.createTransport({
          host: this.config.SMTP_HOST,
          port: this.config.SMTP_PORT,
          secure: this.config.SMTP_PORT === 465,
          requireTLS: true,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          dnsTimeout: 10000,
          socketTimeout: 15000,
          auth: this.config.SMTP_USER
            ? { user: this.config.SMTP_USER, pass: this.config.SMTP_PASSWORD }
            : undefined,
        });
        const result = await transport.sendMail({
          from: this.config.MAIL_FROM,
          to: m.to,
          subject: m.subject,
          text: m.text,
        });
        if (
          !result.accepted?.some(
            (recipient) =>
              (typeof recipient === "string"
                ? recipient
                : recipient.address
              ).toLowerCase() === m.to.toLowerCase(),
          )
        )
          throw Object.assign(new Error("Recipient not accepted"), {
            code: "EENVELOPE",
          });
      } catch (error: unknown) {
        await c.query(
          `UPDATE delivery_outbox SET attempts=attempts+1,last_error_code=$2,
           status=CASE WHEN attempts>=4 THEN 'failed' ELSE 'queued' END,
           next_attempt_at=clock_timestamp()+interval '15 seconds' * power(2,least(attempts,5))
           WHERE id=$1`,
          [row.id, deliveryFailureCode(error)],
        );
        console.warn(`Contact delivery failed (${deliveryFailure(error)}).`);
        return;
      }
      // Database failures propagate rather than being mistaken for SMTP rejection.
      await c.query(
        "UPDATE delivery_outbox SET status='delivered',payload='',last_error_code=NULL,delivered_at=clock_timestamp() WHERE id=$1",
        [row.id],
      );
      return "accepted" as const;
    });
  }
}
