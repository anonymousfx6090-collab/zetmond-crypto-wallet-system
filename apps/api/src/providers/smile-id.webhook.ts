import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  prepareSmileIdStatusLookup,
  SmileIdStatusLookup,
} from "./smile-id.status";

export type SmileIdWebhookHeaders = Record<
  string,
  string | string[] | undefined
>;
export type SmileIdWebhookSignal = {
  purpose: "reconcile_only";
  mode: "sandbox" | "live";
  jobId: string;
  userId: string;
  signedAt: string;
  dedupeKey: string;
};
// Zetmond's local clock-skew/replay window, not a vendor delivery guarantee.
export const smileIdWebhookFreshnessMs = 5 * 60 * 1000;
const timestampSchema = z.string().max(64).datetime({ offset: true });
export class SmileIdWebhookError extends Error {}

function singleHeader(headers: SmileIdWebhookHeaders, name: string) {
  const values = Object.entries(headers).filter(
    ([key]) => key.toLowerCase() === name,
  );
  if (values.length !== 1) throw new Error("Invalid header");
  const value = values[0][1];
  if (typeof value !== "string" || !value || value !== value.trim())
    throw new Error("Invalid header");
  return value;
}

/** Checks the documented timestamp/partner HMAC, NOT the raw JSON body.
 * Expected references must come from an existing persisted operation. Header
 * IDs are not included in the HMAC and are only reconciliation locators.
 * This must not be substituted for VerificationProvider.authenticateWebhook:
 * no callback fields, decisions, evidence or decision revision are trusted here.
 * A future durable inbox must deduplicate the returned key before scheduling
 * authenticated canonical lookup. The freshness window alone is not deduplication.
 */
export function verifySmileIdWebhookSignal(
  headers: SmileIdWebhookHeaders,
  expected: SmileIdStatusLookup,
  credentials: {
    partnerId: string;
    apiKey: string;
    mode: "sandbox" | "live";
  },
  nowMillis = Date.now(),
): SmileIdWebhookSignal {
  try {
    const stored = prepareSmileIdStatusLookup(expected);
    const timestamp = timestampSchema.parse(
      singleHeader(headers, "response-timestamp"),
    );
    const signedMillis = Date.parse(timestamp);
    if (
      !Number.isFinite(nowMillis) ||
      !Number.isFinite(signedMillis) ||
      Math.abs(nowMillis - signedMillis) > smileIdWebhookFreshnessMs
    )
      throw new Error("Expired timestamp");
    const signature = singleHeader(headers, "response-signature");
    if (signature.length !== 44 || !/^[A-Za-z0-9+/]{43}=$/.test(signature))
      throw new Error("Invalid signature encoding");
    const received = Buffer.from(signature, "base64");
    if (received.length !== 32 || received.toString("base64") !== signature)
      throw new Error("Invalid signature encoding");
    // The API key is the literal key used for the original verification token.
    // No JSON, delimiters, job/user IDs or normalized timestamp enter this HMAC.
    const digest = createHmac("sha256", credentials.apiKey)
      .update(timestamp + credentials.partnerId + "sid_request", "utf8")
      .digest();
    if (!timingSafeEqual(received, digest))
      throw new Error("Invalid signature");
    if (
      singleHeader(headers, "smileid-job-id") !== stored.jobId ||
      singleHeader(headers, "user-id") !== stored.userId
    )
      throw new Error("Unexpected references");
    const dedupeKey = createHash("sha256")
      .update(
        JSON.stringify([
          "smile-id-v3-notification",
          credentials.mode,
          stored.jobId,
          stored.userId,
          timestamp,
          signature,
        ]),
      )
      .digest("hex");
    return {
      purpose: "reconcile_only",
      mode: credentials.mode,
      jobId: stored.jobId,
      userId: stored.userId,
      signedAt: timestamp,
      dedupeKey,
    };
  } catch {
    throw new SmileIdWebhookError(
      "Smile ID webhook notification could not be verified.",
    );
  }
}
