import { createHmac, timingSafeEqual } from "node:crypto";
import { Config, ConfigurationError } from "../config";

const origins = {
  sandbox: "https://testapi.smileidentity.com/v1",
  live: "https://api.smileidentity.com/v1",
};
type Mode = keyof typeof origins;
type Transport = typeof fetch;
type Envelope = Record<string, unknown>;
const responseLimit = 256 * 1024;
export class SmileIdError extends Error {}

/** Verified against the official smile-identity-core 3.2.1 signing algorithm.
 * This signature covers timestamp/partner identity, not the full response body.
 */
export function smileIdSignature(
  partnerId: string,
  apiKey: string,
  timestamp: string,
) {
  return createHmac("sha256", apiKey)
    .update(timestamp, "utf8")
    .update(partnerId, "utf8")
    .update("sid_request", "utf8")
    .digest("base64");
}

/** Server-only primitives, not an enabled KYC adapter. Capture, finality and
 * evidence mapping must be verified before wiring this into the provider registry.
 */
export class SmileIdClient {
  #partnerId: string;
  #apiKey: string;
  #transport: Transport;
  #now: () => Date;
  readonly mode: Mode;
  constructor(
    credentials: { partnerId: string; apiKey: string; mode: Mode },
    transport: Transport = fetch,
    now: () => Date = () => new Date(),
  ) {
    this.#partnerId = credentials.partnerId;
    this.#apiKey = credentials.apiKey;
    this.mode = credentials.mode;
    this.#transport = transport;
    this.#now = now;
  }
  async getWebToken(input: {
    userId: string;
    jobId: string;
    product: string;
    callbackUrl: string;
  }) {
    let callback: URL;
    try {
      callback = new URL(input.callbackUrl);
    } catch {
      throw new SmileIdError("Smile ID requires a valid HTTPS callback URL.");
    }
    if (
      callback.protocol !== "https:" ||
      callback.username ||
      callback.password ||
      callback.hash
    )
      throw new SmileIdError("Smile ID requires a valid HTTPS callback URL.");
    if (
      ![input.userId, input.jobId, input.product].every(
        (v) => typeof v === "string" && v.length > 0 && v.length <= 200,
      )
    )
      throw new SmileIdError(
        "Smile ID requires stable user/job identifiers and a selected product.",
      );
    const data = await this.#post("token", {
      user_id: input.userId,
      job_id: input.jobId,
      product: input.product,
      callback_url: input.callbackUrl,
    });
    if (
      typeof data.token !== "string" ||
      !data.token ||
      data.token.length > 16384
    )
      throw new SmileIdError("Smile ID returned an invalid capture token.");
    // Never return request signing data, API keys or arbitrary provider fields.
    return { token: data.token };
  }
  async getJobStatus(userId: string, jobId: string): Promise<Envelope> {
    if (
      ![userId, jobId].every(
        (v) => typeof v === "string" && v.length > 0 && v.length <= 200,
      )
    )
      throw new SmileIdError("Smile ID requires stable user/job identifiers.");
    const data = await this.#post("job_status", {
      user_id: userId,
      job_id: jobId,
      history: false,
      image_links: false,
    });
    if (!this.verifyTimestampSignature(data.timestamp, data.signature))
      throw new SmileIdError("Smile ID returned an invalid status signature.");
    // This is a raw server-only envelope, not approval evidence. The adapter must
    // still validate job/customer binding, product, finality and all required checks.
    return data;
  }
  verifyTimestampSignature(timestamp: unknown, signature: unknown): boolean {
    try {
      if (
        (typeof timestamp !== "string" && typeof timestamp !== "number") ||
        typeof signature !== "string" ||
        signature.length !== 44
      )
        return false;
      const normalized =
        typeof timestamp === "number"
          ? new Date(timestamp).toISOString()
          : timestamp;
      const time = Date.parse(normalized);
      if (
        !Number.isFinite(time) ||
        Math.abs(this.#now().getTime() - time) > 300000
      )
        return false;
      const received = Buffer.from(signature, "base64");
      if (received.length !== 32 || received.toString("base64") !== signature)
        return false;
      return timingSafeEqual(
        received,
        Buffer.from(
          smileIdSignature(this.#partnerId, this.#apiKey, normalized),
          "base64",
        ),
      );
    } catch {
      return false;
    }
  }
  async #post(
    path: "token" | "job_status",
    payload: Envelope,
  ): Promise<Envelope> {
    const timestamp = this.#now().toISOString();
    try {
      const response = await this.#transport(`${origins[this.mode]}/${path}`, {
        method: "POST",
        redirect: "error",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          ...payload,
          partner_id: this.#partnerId,
          timestamp,
          signature: smileIdSignature(this.#partnerId, this.#apiKey, timestamp),
        }),
      });
      if (
        !response.ok ||
        Number(response.headers.get("content-length")) > responseLimit ||
        !response.body
      ) {
        await response.body?.cancel();
        throw new Error("Provider response unavailable");
      }
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > responseLimit) {
            await reader.cancel();
            throw new Error("Provider response too large");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new Error("Invalid provider response");
      return data as Envelope;
    } catch {
      // Upstream errors and bodies can contain customer data or credentials.
      throw new SmileIdError(
        "Smile ID request unavailable. Retry only after reconciling the operation.",
      );
    }
  }
}

/** Partial credentials can be stored during dashboard setup; no requests occur
 * until an implemented integration explicitly constructs this client.
 */
export function configuredSmileIdClient(
  config: Config,
  transport?: Transport,
  now?: () => Date,
) {
  const partnerId = config.SMILE_ID_PARTNER_ID,
    apiKey = config.SMILE_ID_API_KEY;
  if (!partnerId && !apiKey) return undefined;
  if (!partnerId || !apiKey)
    throw new ConfigurationError(
      "Smile ID requires SMILE_ID_PARTNER_ID and SMILE_ID_API_KEY together.",
    );
  if (
    config.NODE_ENV === "production" &&
    ((config.DEPLOYMENT_STAGE === "staging" &&
      config.SMILE_ID_MODE !== "sandbox") ||
      (config.DEPLOYMENT_STAGE === "production" &&
        config.SMILE_ID_MODE !== "live"))
  )
    throw new ConfigurationError(
      "SMILE_ID_MODE must match the deployment stage.",
    );
  return new SmileIdClient(
    { partnerId, apiKey, mode: config.SMILE_ID_MODE },
    transport,
    now,
  );
}
