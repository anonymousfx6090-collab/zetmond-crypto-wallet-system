import { z } from "zod";

// Zetmond transport budgets, not claimed Smile ID service limits. Confirm the
// provider's limits and supported capture procedure before enabling an adapter.
export const documentTransportLimits = {
  imageBytes: 10 * 1024 * 1024,
  totalImageBytes: 40 * 1024 * 1024,
  metadataBytes: 16 * 1024,
} as const;
const httpsUrl = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    try {
      const u = new URL(value);
      return u.protocol === "https:" && !u.username && !u.password && !u.hash;
    } catch {
      return false;
    }
  });
export const smileIdConsentSchema = z
  .object({
    granted: z.literal(true),
    granted_at: z.string().datetime({ offset: true }),
    notice_language: z
      .string()
      .length(2)
      .regex(/^[A-Z]{2}$/),
    notice_privacy_policy_url: httpsUrl,
  })
  .strict();
const requestSchema = z
  .object({
    operationId: z.string().uuid(),
    userId: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
    email: z.string().email().max(254),
    country: z.enum(["NG", "GH", "ZA", "KE"]),
    callbackUrl: httpsUrl,
    consent: smileIdConsentSchema,
    document: z.instanceof(Blob),
    documentBack: z.instanceof(Blob).optional(),
    selfieImage: z.instanceof(Blob),
    livenessImages: z.array(z.instanceof(Blob)).min(6).max(8),
    idType: z.string().trim().min(1).max(100).optional(),
    partnerParams: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type SmileIdDocumentRequest = z.infer<typeof requestSchema>;
export type SmileIdSubmissionAccepted = {
  status: "accepted";
  operationId: string;
  jobId: string;
  userId: string;
  createdAt: string;
};
/** An operation intent must be persisted before calling the transport. Unknown
 * outcomes must be reconciled, never blindly replayed by a worker or customer.
 */
export class SmileIdSubmissionError extends Error {
  constructor(
    readonly outcome: "not_submitted" | "unknown",
    message: string,
    readonly providerJobId?: string,
  ) {
    super(message);
  }
}
const invalid = (
  message = "Provide the document, selfie, 6–8 liveness frames, valid consent and account details.",
): never => {
  throw new SmileIdSubmissionError("not_submitted", message);
};
function jsonPart(value: unknown) {
  let text: string | undefined;
  try {
    text = JSON.stringify(value);
  } catch {
    return invalid("Document metadata must be JSON-serializable.");
  }
  if (
    !text ||
    Buffer.byteLength(text, "utf8") > documentTransportLimits.metadataBytes
  )
    return invalid("Document metadata exceeds the allowed transport budget.");
  return text;
}
async function checkedImage(image: Blob, jpegOnly: boolean) {
  if (!image.size || image.size > documentTransportLimits.imageBytes)
    return invalid(
      "An image is empty or exceeds the allowed transport budget.",
    );
  const bytes = new Uint8Array(await image.slice(0, 8).arrayBuffer());
  const jpeg =
    image.type === "image/jpeg" &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  const png =
    image.type === "image/png" &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if (!jpeg && (jpegOnly || !png))
    return invalid(
      "Selfie/liveness frames must be JPEG; documents must be JPEG or PNG.",
    );
  return png ? "png" : "jpg";
}
/** Fresh-image server path only. The caller must source subject/consent/callback
 * data from authenticated, durable records, not forward an arbitrary browser DTO.
 * JSON object parts use JSON text; verify this encoding against the vendor's curl
 * example/sandbox before activating the adapter. No original filenames are sent.
 */
export async function prepareSmileIdDocument(input: SmileIdDocumentRequest) {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return invalid();
  const d = parsed.data;
  if (
    d.partnerParams?.zetmond_operation_id !== undefined &&
    d.partnerParams.zetmond_operation_id !== d.operationId
  )
    return invalid(
      "Document correlation metadata does not match this operation.",
    );
  const images = [
    d.document,
    d.selfieImage,
    ...d.livenessImages,
    ...(d.documentBack ? [d.documentBack] : []),
  ];
  if (
    images.reduce((sum, image) => sum + image.size, 0) >
    documentTransportLimits.totalImageBytes
  )
    return invalid("Images exceed the total document transport budget.");
  try {
    const documentExt = await checkedImage(d.document, false);
    await checkedImage(d.selfieImage, true);
    for (const image of d.livenessImages) await checkedImage(image, true);
    const backExt = d.documentBack
      ? await checkedImage(d.documentBack, false)
      : undefined;
    const form = new FormData();
    form.append("document", d.document, `document.${documentExt}`);
    if (d.documentBack)
      form.append("document_back", d.documentBack, `document-back.${backExt}`);
    form.append("selfie_image", d.selfieImage, "selfie.jpg");
    d.livenessImages.forEach((image, i) =>
      form.append("liveness_images", image, `liveness-${i + 1}.jpg`),
    );
    form.append("user_id", d.userId);
    form.append("country", d.country);
    form.append("callback_url", d.callbackUrl);
    form.append("consent", jsonPart(d.consent));
    form.append("user_details", jsonPart({ email: d.email }));
    form.append(
      "partner_params",
      jsonPart({ ...d.partnerParams, zetmond_operation_id: d.operationId }),
    );
    if (d.idType) form.append("id_type", d.idType);
    return { form, operationId: d.operationId, userId: d.userId };
  } catch (error) {
    if (error instanceof SmileIdSubmissionError) throw error;
    return invalid(
      "Document images could not be prepared. No submission was sent.",
    );
  }
}
// Exact TypeID format supplied by the V3 result-retrieval reference.
export const smileIdJobIdSchema = z
  .string()
  .length(30)
  .regex(/^job_[0-9a-hjkmnp-tv-z]{26}$/);
const acceptanceSchema = z.object({
  status: z.literal("accepted"),
  job_id: smileIdJobIdSchema,
  user_id: z.string().min(1).max(200),
  created_at: z.string().datetime({ offset: true }),
});
export function parseSmileIdAcceptance(
  data: Record<string, unknown>,
  expected: { operationId: string; userId: string },
): SmileIdSubmissionAccepted {
  const result = acceptanceSchema.safeParse(data);
  const job = smileIdJobIdSchema.safeParse(data.job_id);
  if (!result.success || result.data.user_id !== expected.userId)
    throw new SmileIdSubmissionError(
      "unknown",
      "Smile ID submission acknowledgement is invalid or bound to another user; reconcile before retrying.",
      job.success ? job.data : undefined,
    );
  return {
    status: "accepted",
    operationId: expected.operationId,
    jobId: result.data.job_id,
    userId: result.data.user_id,
    createdAt: result.data.created_at,
  };
}
