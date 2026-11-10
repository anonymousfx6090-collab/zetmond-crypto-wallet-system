import { z } from "zod";
import { countries } from "../markets";
import {
  documentTransportLimits,
  smileIdConsentSchema,
  smileIdHttpsUrlSchema,
  smileIdUserIdSchema,
} from "./smile-id.document";

const sessionSchema = z
  .object({
    operationId: z.string().uuid(),
    userId: smileIdUserIdSchema,
    country: z.enum(countries),
    email: z.string().email().max(254),
    callbackUrl: smileIdHttpsUrlSchema,
    givenNames: z.string().trim().min(1).max(200).optional(),
    lastName: z.string().trim().min(1).max(200).optional(),
    idType: z.string().trim().min(1).max(100).optional(),
    consent: smileIdConsentSchema.optional(),
  })
  .strict();
export type SmileIdDocumentSessionRequest = z.infer<typeof sessionSchema>;
export class SmileIdSessionError extends Error {
  constructor(
    readonly code: "invalid_request" | "issuance_failed" | "expired",
    message: string,
  ) {
    super(message);
  }
}

/** Only accepts context from an authenticated, persisted current attempt.
 * The HTTP issuer must enforce ownership, eligibility, CSRF and rate/lease
 * limits before invoking this; never forward an arbitrary browser token request.
 * Token product is fixed to the REST product, not the SDK's doc_verification alias.
 * No enrolled-image or re-enrolment grants are accepted; provider defaults stay false.
 */
export function prepareSmileIdDocumentSession(
  input: SmileIdDocumentSessionRequest,
  nowMillis = Date.now(),
) {
  try {
    const d = sessionSchema.parse(input);
    if (!Number.isFinite(nowMillis)) throw new Error("Invalid clock");
    if (d.consent) {
      const grantedMillis = Date.parse(d.consent.granted_at);
      if (!Number.isFinite(grantedMillis) || grantedMillis > nowMillis + 60000)
        throw new Error("Invalid consent time");
    }
    const payload = JSON.stringify({
      country: d.country,
      email: d.email,
      callback_url: d.callbackUrl,
      given_names: d.givenNames,
      last_name: d.lastName,
      id_type: d.idType,
      consent: d.consent,
    });
    if (
      Buffer.byteLength(payload, "utf8") > documentTransportLimits.metadataBytes
    )
      throw new Error("Payload too large");
    const form = new FormData();
    form.append("user_id", d.userId);
    form.append("product", "document_verification");
    form.append(
      "partner_params",
      JSON.stringify({ zetmond_operation_id: d.operationId }),
    );
    // Structured multipart fields use JSON text, as in the document transport.
    // Vendor SDK/sandbox validation of this encoding remains required before activation.
    form.append("payload", payload);
    return form;
  } catch {
    throw new SmileIdSessionError(
      "invalid_request",
      "Provide the stored attempt, subject, verified email, country, HTTPS callback and valid optional consent.",
    );
  }
}
