import { performance } from "node:perf_hooks";
import { Config, ConfigurationError, smileIdPartnerIdSchema } from "../config";
import {
  prepareSmileIdDocument,
  parseSmileIdAcceptance,
  SmileIdSubmissionError,
  SmileIdDocumentRequest,
  SmileIdSubmissionAccepted,
} from "./smile-id.document";
import {
  parseSmileIdStatus,
  prepareSmileIdStatusLookup,
  SmileIdJobStatus,
  SmileIdStatusError,
  SmileIdStatusLookup,
} from "./smile-id.status";
import {
  SmileIdWebhookHeaders,
  SmileIdWebhookSignal,
  verifySmileIdWebhookSignal,
} from "./smile-id.webhook";
import {
  parseSmileIdReplayAcceptance,
  SmileIdReplayAccepted,
  SmileIdReplayError,
} from "./smile-id.replay";
import {
  prepareSmileIdDocumentSession,
  SmileIdDocumentSessionRequest,
  SmileIdSessionError,
} from "./smile-id.session";

const tokenUrls = {
  sandbox: "https://testapi.smileidentity.com/v3/token",
  live: "https://api.smileidentity.com/v3/token",
};
type Mode = keyof typeof tokenUrls;
type Transport = typeof fetch;
type CachedToken = { value: string; usableUntil: number };
const responseLimit = 256 * 1024;
// The supplied V3 contract gives a 15-minute lifetime. Refresh a minute early,
// measuring from request start with a monotonic clock rather than wall-clock time.
const tokenCacheMs = 14 * 60 * 1000;
export class SmileIdError extends Error {}

/** Server-only V3 transport. Cached unscoped tokens remain private; only dedicated
 * bound session tokens are used by the opt-in browser adapter. Neither token
 * kind is KYC evidence; the transport never owns eligibility or HTTP routes.
 */
export class SmileIdClient {
  #partnerId: string;
  #apiKey: string;
  #transport: Transport;
  #now: () => number;
  #cached?: CachedToken;
  #pending?: Promise<CachedToken>;
  #generation = 0;
  readonly mode: Mode;
  constructor(
    credentials: { partnerId: string; apiKey: string; mode: Mode },
    transport: Transport = fetch,
    now: () => number = () => performance.now(),
  ) {
    const partnerId = smileIdPartnerIdSchema.safeParse(credentials.partnerId);
    if (!partnerId.success)
      throw new ConfigurationError(
        "Smile ID partner ID must be numeric with no leading zeros.",
      );
    this.#partnerId = partnerId.data;
    this.#apiKey = credentials.apiKey;
    this.mode = credentials.mode;
    this.#transport = transport;
    this.#now = now;
  }
  async getAccessToken(): Promise<string> {
    if (this.#cached && this.#now() < this.#cached.usableUntil)
      return this.#cached.value;
    if (!this.#pending) {
      const startedAt = this.#now(),
        generation = this.#generation;
      const pending = this.#issueToken().then((value) => {
        if (
          generation !== this.#generation ||
          this.#now() >= startedAt + tokenCacheMs
        )
          throw new SmileIdError(
            "Smile ID token request was superseded or expired. Request a fresh token.",
          );
        const result = { value, usableUntil: startedAt + tokenCacheMs };
        this.#cached = result;
        return result;
      });
      this.#pending = pending;
      const clear = () => {
        if (this.#pending === pending) this.#pending = undefined;
      };
      // Both handlers resolve so failed token requests leave no unhandled cleanup promise.
      void pending.then(clear, clear);
    }
    return (await this.#pending).value;
  }
  async getRequestHeaders(): Promise<Record<string, string>> {
    return {
      "SmileID-Partner-ID": this.#partnerId,
      "SmileID-Token": await this.getAccessToken(),
    };
  }
  /** Fresh issuance per document session, never cached or coalesced with lookup
   * tokens or other customers. Payload bindings are enforced by the vendor, not
   * browser config. Return only the opaque JWT; no API key or source PII/URL.
   */
  async issueDocumentSessionToken(
    input: SmileIdDocumentSessionRequest,
  ): Promise<string> {
    const form = prepareSmileIdDocumentSession(input);
    const startedAt = this.#now();
    let token: string;
    try {
      token = await this.#issueToken(form);
    } catch {
      throw new SmileIdSessionError(
        "issuance_failed",
        "Smile ID document session token could not be issued.",
      );
    }
    const completedAt = this.#now();
    if (
      !Number.isFinite(startedAt) ||
      !Number.isFinite(completedAt) ||
      completedAt < startedAt ||
      completedAt >= startedAt + tokenCacheMs
    )
      throw new SmileIdSessionError(
        "expired",
        "Smile ID document session token is no longer fresh; request a new session.",
      );
    return token;
  }
  /** Persists nothing by itself: the adapter must durably record intent before
   * invoking this, save the generated job ID, and reconcile unknown outcomes.
   * Never automatically retries a verification, including after token rejection.
   */
  async submitDocumentVerification(
    input: SmileIdDocumentRequest,
  ): Promise<SmileIdSubmissionAccepted> {
    const prepared = await prepareSmileIdDocument(input);
    let headers: Record<string, string>;
    try {
      // The authentication reference recommends a fresh token per verification.
      headers = {
        "SmileID-Partner-ID": this.#partnerId,
        "SmileID-Token": await this.#issueToken(),
      };
    } catch {
      throw new SmileIdSubmissionError(
        "not_submitted",
        "Smile ID authentication unavailable; document was not submitted.",
      );
    }
    let response: Response;
    try {
      response = await this.#transport(
        tokenUrls[this.mode].replace(/\/token$/, "/document_verification"),
        {
          method: "POST",
          headers: { ...headers, Accept: "application/json" },
          body: prepared.form,
          redirect: "error",
          credentials: "omit",
          signal: AbortSignal.timeout(60000),
          // Native FormData supplies its boundary; do not manually set Content-Type.
        },
      );
    } catch {
      throw new SmileIdSubmissionError(
        "unknown",
        "Smile ID submission outcome is unknown; reconcile before retrying.",
      );
    }
    if (response.status !== 202) {
      if (response.status === 401)
        this.invalidateAccessToken(headers["SmileID-Token"]);
      try {
        await response.body?.cancel();
      } catch {
        /* Never expose response contents. */
      }
      throw new SmileIdSubmissionError(
        "unknown",
        `Smile ID did not acknowledge submission (HTTP ${response.status}); reconcile before retrying.`,
      );
    }
    let data: Record<string, unknown>;
    try {
      data = await this.#readResponse(response);
    } catch {
      throw new SmileIdSubmissionError(
        "unknown",
        "Smile ID submission acknowledgement is unreadable; reconcile before retrying.",
      );
    }
    return parseSmileIdAcceptance(data, prepared);
  }
  /** Fetches tracking for an existing operation, never submits/recreates a job.
   * Even a terminal clear response is not sufficient KYC evidence or approval.
   */
  async getVerificationStatus(
    input: SmileIdStatusLookup,
  ): Promise<SmileIdJobStatus> {
    const expected = prepareSmileIdStatusLookup(input);
    let headers: Record<string, string>;
    try {
      headers = await this.getRequestHeaders();
    } catch {
      throw new SmileIdStatusError(
        "unavailable",
        "Smile ID authentication unavailable; status was not requested.",
      );
    }
    let response: Response;
    try {
      response = await this.#transport(
        tokenUrls[this.mode].replace(
          /\/token$/,
          `/status/${encodeURIComponent(expected.jobId)}`,
        ),
        {
          method: "GET",
          headers: { ...headers, Accept: "application/json" },
          redirect: "error",
          credentials: "omit",
          signal: AbortSignal.timeout(10000),
        },
      );
    } catch {
      throw new SmileIdStatusError(
        "unavailable",
        "Smile ID status lookup unavailable; retain the existing operation.",
      );
    }
    if (response.status !== 200 && response.status !== 202) {
      if (response.status === 401)
        this.invalidateAccessToken(headers["SmileID-Token"]);
      try {
        await response.body?.cancel();
      } catch {
        /* Do not expose provider response details. */
      }
      throw new SmileIdStatusError(
        response.status === 404 ? "not_found" : "provider_error",
        `Smile ID status lookup failed (HTTP ${response.status}); retain and reconcile the existing operation.`,
        response.status,
      );
    }
    let data: Record<string, unknown>;
    try {
      data = await this.#readResponse(response);
    } catch {
      throw new SmileIdStatusError(
        "invalid_response",
        "Smile ID returned an unreadable status response.",
      );
    }
    return parseSmileIdStatus(data, response.status, expected);
  }
  /** Queues callback delivery for an existing terminal job, not a verification.
   * Uses the stored callback URL: overrides are deliberately not accepted.
   * The adapter must durably record/rate-limit replay intents and reconcile an
   * uncertain POST before requesting another replay. No automatic retries.
   */
  async replayVerificationWebhook(
    input: SmileIdStatusLookup,
  ): Promise<SmileIdReplayAccepted> {
    let expected: SmileIdStatusLookup;
    try {
      expected = prepareSmileIdStatusLookup(input);
    } catch {
      throw new SmileIdReplayError(
        "not_queued",
        "invalid_request",
        "Provide the stored Smile ID job reference and its expected user.",
      );
    }
    let tracking: SmileIdJobStatus;
    try {
      tracking = await this.getVerificationStatus(expected);
    } catch (error) {
      throw new SmileIdReplayError(
        "not_queued",
        "lookup_failed",
        "Smile ID job status could not be confirmed; callback replay was not requested.",
        error instanceof SmileIdStatusError ? error.httpStatus : undefined,
      );
    }
    if (tracking.phase !== "terminal")
      throw new SmileIdReplayError(
        "not_queued",
        "not_terminal",
        "Wait for the existing Smile ID job to complete before requesting replay.",
      );
    let headers: Record<string, string>;
    try {
      headers = await this.getRequestHeaders();
    } catch {
      throw new SmileIdReplayError(
        "not_queued",
        "authentication_unavailable",
        "Smile ID authentication unavailable; callback replay was not requested.",
      );
    }
    let response: Response;
    try {
      response = await this.#transport(
        tokenUrls[this.mode].replace(
          /\/token$/,
          `/replay/${encodeURIComponent(expected.jobId)}`,
        ),
        {
          method: "POST",
          headers: { ...headers, Accept: "application/json" },
          redirect: "error",
          credentials: "omit",
          signal: AbortSignal.timeout(10000),
          // Bodyless replay uses the stored callback; never send JSON or an override.
        },
      );
    } catch {
      throw new SmileIdReplayError(
        "unknown",
        "unavailable",
        "Smile ID replay outcome is unknown; reconcile before retrying.",
      );
    }
    if (response.status !== 202) {
      if (response.status === 401)
        this.invalidateAccessToken(headers["SmileID-Token"]);
      try {
        await response.body?.cancel();
      } catch {
        /* Do not expose provider response details. */
      }
      const rejected = [400, 401, 403, 404, 409, 415].includes(response.status);
      throw new SmileIdReplayError(
        rejected ? "not_queued" : "unknown",
        response.status === 409
          ? "not_terminal"
          : response.status === 404
            ? "not_found"
            : "provider_error",
        `Smile ID did not acknowledge callback replay (HTTP ${response.status}); retain and reconcile the existing job.`,
        response.status,
      );
    }
    let data: Record<string, unknown>;
    try {
      data = await this.#readResponse(response);
    } catch {
      throw new SmileIdReplayError(
        "unknown",
        "invalid_response",
        "Smile ID replay acknowledgement is unreadable; reconcile before retrying.",
        202,
      );
    }
    return parseSmileIdReplayAcceptance(data, expected);
  }
  /** Timestamp/partner proof only; callback JSON is not covered by this HMAC.
   * Uses this instance's configured credentials, not values from the callback.
   */
  verifyWebhookSignal(
    headers: SmileIdWebhookHeaders,
    expected: SmileIdStatusLookup,
    nowMillis = Date.now(),
  ): SmileIdWebhookSignal {
    return verifySmileIdWebhookSignal(
      headers,
      expected,
      { partnerId: this.#partnerId, apiKey: this.#apiKey, mode: this.mode },
      nowMillis,
    );
  }
  /** On an authentication failure, pass the rejected token. A late rejection of
   * an older token must not evict a newer token. This never replays an API request.
   */
  invalidateAccessToken(rejectedToken?: string) {
    if (rejectedToken !== undefined && this.#cached?.value !== rejectedToken)
      return;
    this.#generation++;
    this.#cached = undefined;
    this.#pending = undefined;
  }
  async #issueToken(body?: FormData): Promise<string> {
    let response: Response;
    try {
      response = await this.#transport(tokenUrls[this.mode], {
        method: "POST",
        redirect: "error",
        credentials: "omit",
        headers: {
          "SmileID-API-Key": this.#apiKey,
          "SmileID-Partner-ID": this.#partnerId,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
        body,
        // Bodyless server auth or native multipart session scope; FormData sets
        // its own boundary. Never send JSON or manually set Content-Type here.
      });
    } catch {
      // Never forward transport errors: they may include request credentials.
      throw new SmileIdError(
        "Smile ID token request unavailable. Check provider connectivity and retry safely.",
      );
    }
    if (response.status !== 200) {
      try {
        await response.body?.cancel();
      } catch {
        /* No provider details in errors. */
      }
      throw new SmileIdError(
        `Smile ID token request failed (HTTP ${response.status}).`,
      );
    }
    const data = await this.#readResponse(response);
    if (
      typeof data.token !== "string" ||
      data.token !== data.token.trim() ||
      data.token.length > 16384 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(data.token)
    )
      throw new SmileIdError("Smile ID returned an invalid access token.");
    // Treat the JWT as an opaque credential. Do not interpret its claims as
    // customer authorization, KYC evidence, or a substitute for provider results.
    return data.token;
  }
  async #readResponse(response: Response): Promise<Record<string, unknown>> {
    try {
      if (
        Number(response.headers.get("content-length")) > responseLimit ||
        !response.body
      ) {
        await response.body?.cancel();
        throw new Error("Invalid provider response");
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
      return data as Record<string, unknown>;
    } catch {
      throw new SmileIdError("Smile ID returned an invalid provider response.");
    }
  }
}

/** Optional configuration; no network calls occur until a completed integration
 * requests a token. Credentials are fixed per instance and deployment mode.
 */
export function configuredSmileIdClient(
  config: Config,
  transport?: Transport,
  now?: () => number,
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
