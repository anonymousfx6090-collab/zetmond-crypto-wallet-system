import { z } from "zod";
export const countries = ["NG", "GH", "ZA", "KE"] as const;
export type Country = (typeof countries)[number];
export type Mode = "sandbox" | "live";
export const currency: Record<Country, string> = {
  NG: "NGN",
  GH: "GHS",
  ZA: "ZAR",
  KE: "KES",
};
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  });
export const identityResult = z
  .object({
    operationId: z.string().uuid(),
    mode: z.enum(["sandbox", "live"]),
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    status: z.enum([
      "incomplete",
      "under_review",
      "approved",
      "correction_required",
      "rejected",
    ]),
    reason: z
      .enum([
        "document_unreadable",
        "document_expired",
        "identity_mismatch",
        "liveness_failed",
        "unsupported_document",
        "review_required",
      ])
      .optional(),
    capture: z
      .object({ url: z.string().url(), expiresAt: z.string().datetime() })
      .optional(),
    evidence: z
      .object({
        legalName: z.string().trim().min(1).max(200),
        dateOfBirth: date,
        country: z.enum(countries),
        governmentIdVerified: z.literal(true),
        livenessVerified: z.literal(true),
      })
      .optional(),
  })
  .strict();
export const bankResult = z
  .object({
    operationId: z.string().uuid(),
    mode: z.enum(["sandbox", "live"]),
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    status: z.enum(["pending", "verified", "mismatch", "unavailable"]),
    evidence: z
      .object({
        ownerName: z.string().trim().min(1).max(200),
        ownershipVerified: z.literal(true),
        accountFingerprint: z.string(),
        identityAttemptId: z.string().uuid(),
        policyVersion: z.string().min(1).max(80),
        nameMatch: z.literal(true),
      })
      .optional(),
  })
  .strict();
export type IdentityResult = z.infer<typeof identityResult>;
export type BankResult = z.infer<typeof bankResult>;
export type BankDetails = {
  country: Country;
  bankCode: string;
  accountNumber: string;
};
export type BankField = {
  label: string;
  pattern: string;
  minLength: number;
  maxLength: number;
  inputMode: "numeric" | "text";
};
/** Implement against a selected vendor's documented contracts, never browser-supplied decisions.
 * All operations must support stable idempotency keys and canonical authenticated lookup.
 * A missing lookup MUST safely create-or-recover the same operation, never a new charge.
 * revision is a monotonic canonical version (not webhook arrival order).
 */
export interface VerificationProvider {
  id: string;
  mode: Mode;
  captureOrigins: readonly string[];
  identityCountries: readonly Country[];
  bankCountries: readonly Country[];
  disclosure: { version: string; url: string };
  bankPolicyVersion: string;
  identityStart(input: {
    operationId: string;
    country: Country;
    returnUrl: string;
  }): Promise<IdentityResult>;
  identityStatus(operationId: string): Promise<IdentityResult>;
  banks(country: Country): Promise<{ code: string; name: string }[]>;
  bankField(country: Country): BankField;
  bankStart(input: {
    operationId: string;
    details: BankDetails;
    accountFingerprint: string;
    identityAttemptId: string;
    identity: NonNullable<IdentityResult["evidence"]>;
  }): Promise<BankResult>;
  bankStatus(operationId: string): Promise<BankResult>;
  /** Verify raw bytes, signature and signed timestamp (including freshness) before parsing.
   * Invalid, unsigned, wrong-mode or replay-window-expired requests must throw.
   */
  authenticateWebhook(
    raw: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ eventId: string; operationId: string; mode: Mode }>;
}
/** Deliberately empty until a real provider contract and account are selected.
 * No environment switch or HTTP endpoint can select a fixture provider.
 */
export function configuredVerificationProviders(): VerificationProvider[] {
  return [];
}
export function adult(dateOfBirth: string, now = new Date()) {
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()),
  );
  return birth <= cutoff;
}
