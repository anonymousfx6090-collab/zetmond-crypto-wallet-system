import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import nodemailer from "nodemailer";
import { Database } from "../db";
import { Config } from "../config";
import { seal, unseal } from "../crypto";
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
  ) {
    await c.query(
      "INSERT INTO delivery_outbox(id,user_id,channel,payload,expires_at) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        userId,
        channel,
        seal(this.config.DATA_ENCRYPTION_KEY, message),
        expiresAt || null,
      ],
    );
  }
  async dispatch() {
    await this.db.pool.query(
      "UPDATE delivery_outbox SET status='expired',payload='' WHERE expires_at<=now() AND status IN ('queued','failed')",
    );
    if (this.config.DELIVERY_MODE === "development") return; // Encrypted local outbox; never expose a debug API.
    await this.db.tx(async (c) => {
      const rows = await c.query(
        "SELECT * FROM delivery_outbox WHERE channel='email' AND status='queued' AND next_attempt_at<=now() ORDER BY created_at LIMIT 5 FOR UPDATE SKIP LOCKED",
      );
      for (const row of rows.rows) {
        try {
          const m = unseal<Message>(
            this.config.DATA_ENCRYPTION_KEY,
            row.payload,
          );
          const transport = nodemailer.createTransport({
            host: this.config.SMTP_HOST,
            port: this.config.SMTP_PORT,
            secure: this.config.SMTP_PORT === 465,
            requireTLS: true,
            connectionTimeout: 10000,
            socketTimeout: 15000,
            auth: this.config.SMTP_USER
              ? {
                  user: this.config.SMTP_USER,
                  pass: this.config.SMTP_PASSWORD,
                }
              : undefined,
          });
          if (!this.config.SMTP_HOST || !this.config.MAIL_FROM)
            throw new Error("Email not configured");
          await transport.sendMail({
            from: this.config.MAIL_FROM,
            to: m.to,
            subject: m.subject,
            text: m.text,
          });
          await c.query(
            "UPDATE delivery_outbox SET status='delivered',payload='',delivered_at=now() WHERE id=$1",
            [row.id],
          );
        } catch {
          await c.query(
            "UPDATE delivery_outbox SET attempts=attempts+1,status=CASE WHEN attempts>=4 THEN 'failed' ELSE 'queued' END,next_attempt_at=now()+interval '1 minute' * power(2,least(attempts,5)) WHERE id=$1",
            [row.id],
          );
          console.warn(
            "Contact delivery failed; inspect outbox status without exposing message contents",
          );
        }
      }
    });
  }
}
