import { z } from "zod";
import { adult, Country, IdentityResult, Mode } from "./verification";
import { smileIdJobIdSchema, smileIdUserIdSchema } from "./smile-id.document";

const text = z.string().trim().min(1).max(200).nullish();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  });
const schema = z.object({
  product: z.literal("document_verification"),
  status: z.enum(["clear", "attention", "block", "error"]),
  reason: z.string().max(200).nullish(),
  created_at: z.string().max(64).datetime({ offset: true }),
  completed_at: z.string().max(64).datetime({ offset: true }),
  partner_params: z.object({
    zetmond_operation_id: z.string().uuid(),
    job_id: smileIdJobIdSchema,
    user_id: smileIdUserIdSchema,
  }),
  id_fields: z
    .object({
      full_name: text,
      first_name: text,
      other_names: text,
      last_name: text,
      country: z.string().length(2).nullish(),
      date_of_birth: date.nullish(),
      expiration_date: date.nullish(),
      issuance_date: date.nullish(),
      is_deceased: z.boolean().nullish(),
    })
    .nullish(),
  antifraud: z
    .object({
      fraud_risk: z
        .object({
          risk_level: z.string().max(80).nullish(),
          risk_score: z.number().finite().nonnegative().nullish(),
          risk_indicators: z.array(z.string().max(200)).nullish(),
        })
        .nullish(),
      summary: z
        .object({
          fraud_detected: z.boolean().nullish(),
          fraud_sources: z.array(z.unknown()).nullish(),
        })
        .nullish(),
      smile_secure: z
        .object({
          status: z.string().max(80).nullish(),
          suspect_users: z.array(z.unknown()).nullish(),
        })
        .nullish(),
    })
    .nullish(),
  consent: z
    .object({ privacy_notice: z.string().max(2048).nullish(), record_id: text })
    .nullish(),
});
/** Shape/projection only. The caller must independently authenticate the private
 * callback capability and timestamp proof before storing/using this result.
 */
export function parseSmileDocumentCallback(raw: Buffer) {
  if (!Buffer.isBuffer(raw) || !raw.length || raw.length > 64 * 1024)
    throw new Error("Invalid document callback");
  try {
    const d = schema.parse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)),
    );
    if (Date.parse(d.completed_at) < Date.parse(d.created_at))
      throw new Error();
    const id = d.id_fields;
    const legalName =
      id?.full_name ||
      [id?.first_name, id?.other_names, id?.last_name]
        .filter(Boolean)
        .join(" ") ||
      null;
    if (legalName && legalName.length > 200) throw new Error();
    return {
      operationId: d.partner_params.zetmond_operation_id,
      jobId: d.partner_params.job_id,
      userId: d.partner_params.user_id,
      status: d.status,
      reason: d.reason || null,
      createdAt: new Date(d.created_at).toISOString(),
      completedAt: new Date(d.completed_at).toISOString(),
      identity: id
        ? {
            legalName,
            country: id.country || null,
            dateOfBirth: id.date_of_birth || null,
            expiresOn: id.expiration_date || null,
            issuedOn: id.issuance_date || null,
            deceased: id.is_deceased ?? null,
          }
        : null,
      fraud: {
        riskLevel: d.antifraud?.fraud_risk?.risk_level ?? null,
        riskScore: d.antifraud?.fraud_risk?.risk_score ?? null,
        indicators: d.antifraud?.fraud_risk?.risk_indicators?.length || 0,
        detected: d.antifraud?.summary?.fraud_detected ?? null,
        sources: d.antifraud?.summary?.fraud_sources?.length || 0,
        secureStatus: d.antifraud?.smile_secure?.status ?? null,
        suspects: d.antifraud?.smile_secure?.suspect_users?.length || 0,
      },
      consentNotice: d.consent?.privacy_notice || null,
      consentRecord: d.consent?.record_id || null,
    };
  } catch {
    throw new Error("Invalid document callback");
  }
}
export type SmileDocumentCore = ReturnType<typeof parseSmileDocumentCallback>;

export function smileDocumentDecision(
  core: SmileDocumentCore,
  scope: {
    operationId: string;
    mode: Mode;
    country: Country;
    createdAt: Date;
    policyUrl: string;
  },
  now = new Date(),
): Omit<IdentityResult, "revision"> {
  const base = { operationId: scope.operationId, mode: scope.mode };
  const review = (): Omit<IdentityResult, "revision"> => ({
    ...base,
    status: "under_review",
    reason: "review_required",
  });
  if (
    core.operationId !== scope.operationId ||
    Date.parse(core.createdAt) < scope.createdAt.getTime() ||
    Date.parse(core.completedAt) > now.getTime() + 60000 ||
    (core.consentNotice && core.consentNotice !== scope.policyUrl)
  )
    return review();
  if (core.reason === "age_requirement_not_met")
    return { ...base, status: "rejected", reason: "age_requirement" };
  if (core.reason === "document_expired")
    return {
      ...base,
      status: "correction_required",
      reason: "document_expired",
    };
  if (core.reason === "image_unavailable_or_invalid")
    return {
      ...base,
      status: "correction_required",
      reason: "document_unreadable",
    };
  if (core.reason === "unsupported_document")
    return {
      ...base,
      status: "correction_required",
      reason: "unsupported_document",
    };
  if (core.status === "block")
    return { ...base, status: "rejected", reason: "review_required" };
  if (core.status !== "clear" || core.reason) return review();
  const f = core.fraud;
  if (
    f.detected ||
    f.sources ||
    f.indicators ||
    f.suspects ||
    (f.riskScore != null && f.riskScore > 0) ||
    (f.riskLevel != null && f.riskLevel !== "low") ||
    (f.secureStatus != null && f.secureStatus !== "clear")
  )
    return review();
  const id = core.identity;
  if (
    !id?.legalName ||
    !id.dateOfBirth ||
    !id.country ||
    id.deceased ||
    (id.issuedOn && id.issuedOn > now.toISOString().slice(0, 10))
  )
    return review();
  if (id.country !== scope.country)
    return { ...base, status: "rejected", reason: "country_mismatch" };
  if (!adult(id.dateOfBirth, now))
    return { ...base, status: "rejected", reason: "age_requirement" };
  if (id.expiresOn && id.expiresOn < now.toISOString().slice(0, 10))
    return {
      ...base,
      status: "correction_required",
      reason: "document_expired",
    };
  return {
    ...base,
    status: "approved",
    evidence: {
      legalName: id.legalName,
      country: scope.country,
      dateOfBirth: id.dateOfBirth,
      governmentIdVerified: true,
      livenessVerified: true,
    },
  };
}
