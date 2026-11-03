import { z } from "zod";
const positive = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  DATA_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  APP_ORIGIN: z.string().url().default("http://127.0.0.1:4200"),
  PORT: positive(4100),
  DELIVERY_MODE: z.enum(["development", "provider"]).default("development"),
  SECURITY_POLICY_APPROVED: z.enum(["true", "false"]).default("false"),
  TERMS_VERSION: z.string().default("development-draft"),
  TERMS_URL: z.string().url().optional(),
  PRIVACY_URL: z.string().url().optional(),
  SESSION_MINUTES: positive(720),
  ADMIN_SESSION_MINUTES: positive(60),
  CHALLENGE_MINUTES: positive(10),
  CHALLENGE_ATTEMPTS: positive(5),
  LOGIN_ATTEMPTS: positive(5),
  LOCKOUT_MINUTES: positive(15),
  RATE_WINDOW_SECONDS: positive(900),
  RATE_LIMIT: positive(30),
  RESEND_SECONDS: positive(60),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: positive(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  SMS_GATEWAY_URL: z.string().url().optional(),
  SMS_GATEWAY_TOKEN: z.string().optional(),
});
export type Config = z.infer<typeof schema>;
export function loadConfig(env = process.env): Config {
  const c = schema.parse(env);
  if (new URL(c.APP_ORIGIN).origin !== c.APP_ORIGIN)
    throw new Error(
      "APP_ORIGIN must be an exact origin without path or trailing slash",
    );
  if (c.NODE_ENV === "production") {
    if (
      c.DELIVERY_MODE !== "provider" ||
      c.SECURITY_POLICY_APPROVED !== "true" ||
      c.TERMS_VERSION === "development-draft"
    )
      throw new Error(
        "Production requires provider delivery, approved security policy and approved terms version",
      );
    if (
      !c.TERMS_URL?.startsWith("https://") ||
      !c.PRIVACY_URL?.startsWith("https://")
    )
      throw new Error(
        "Production requires approved HTTPS terms and privacy notice URLs",
      );
    if (
      !c.APP_ORIGIN.startsWith("https://") ||
      !c.SMTP_HOST ||
      !c.MAIL_FROM ||
      !c.SMS_GATEWAY_URL?.startsWith("https://") ||
      !c.SMS_GATEWAY_TOKEN
    )
      throw new Error(
        "Production requires HTTPS and configured email/SMS delivery",
      );
  }
  return c;
}
