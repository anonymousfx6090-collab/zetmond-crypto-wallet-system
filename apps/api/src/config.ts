import { z } from "zod";
const positive = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DEPLOYMENT_STAGE: z.enum(["staging", "production"]).default("production"),
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
  SMILE_ID_PARTNER_ID: z.string().trim().min(1).max(100).optional(),
  SMILE_ID_API_KEY: z.string().trim().min(1).max(4096).optional(),
  SMILE_ID_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  REDIS_URL: z
    .string()
    .url()
    .refine((v) => ["redis:", "rediss:"].includes(new URL(v).protocol))
    .optional(),
});
export type Config = z.infer<typeof schema>;
export class ConfigurationError extends Error {}
export const deploymentStage = (config: Config) =>
  config.NODE_ENV === "production" ? config.DEPLOYMENT_STAGE : "development";

export function loadConfig(env = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join("."))),
    ];
    // Report field names only. Validation details can contain supplied secrets.
    throw new ConfigurationError(
      `Invalid API configuration. Check: ${fields.join(", ")}.`,
    );
  }
  const c = parsed.data;
  if (c.DEPLOYMENT_STAGE === "staging" && c.NODE_ENV !== "production")
    throw new ConfigurationError(
      "DEPLOYMENT_STAGE=staging requires NODE_ENV=production for HTTPS cookies and hosted networking.",
    );
  if (new URL(c.APP_ORIGIN).origin !== c.APP_ORIGIN)
    throw new ConfigurationError(
      "APP_ORIGIN must be an exact origin without path or trailing slash",
    );
  if (c.NODE_ENV === "production") {
    const requirements: [keyof Config, boolean][] = [
      ["DELIVERY_MODE", c.DELIVERY_MODE === "provider"],
      ["APP_ORIGIN", c.APP_ORIGIN.startsWith("https://")],
      ["SMTP_HOST", !!c.SMTP_HOST],
      ["MAIL_FROM", !!c.MAIL_FROM],
    ];
    if (c.DEPLOYMENT_STAGE === "production")
      requirements.push(
        ["SECURITY_POLICY_APPROVED", c.SECURITY_POLICY_APPROVED === "true"],
        [
          "TERMS_VERSION",
          !!c.TERMS_VERSION && c.TERMS_VERSION !== "development-draft",
        ],
        ["TERMS_URL", !!c.TERMS_URL?.startsWith("https://")],
        ["PRIVACY_URL", !!c.PRIVACY_URL?.startsWith("https://")],
      );
    const missing = requirements
      .filter(([, valid]) => !valid)
      .map(([field]) => field);
    if (missing.length)
      throw new ConfigurationError(
        `${c.DEPLOYMENT_STAGE === "staging" ? "Staging requires HTTPS and configured email delivery" : "Production requires provider delivery, approved security policy and terms, HTTPS, and configured email delivery"}. Check: ${missing.join(", ")}.`,
      );
  }
  return c;
}
