import { HttpException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { Config, ConfigurationError } from "../config";
import { Database } from "../db";
import { digest, hash, seal, unseal } from "../crypto";
import { supportedCountries, isSupportedCountry } from "../markets";
import { configuredSmileIdClient, SmileIdClient } from "./smile-id.client";
import { SmileIdReplayError } from "./smile-id.replay";
import { smileIdCallbackSettings } from "./smile-id.settings";
import {
  parseSmileDocumentCallback,
  SmileDocumentCore,
  smileDocumentDecision,
} from "./smile-id.result";
import {
  BrowserCaptureContext,
  BrowserCaptureSession,
  Country,
  IdentityResult,
  Mode,
  ProviderEvent,
  VerificationProvider,
  WebhookContext,
} from "./verification";

const stop = (message: string, status = 409): never => {
  throw new HttpException({ message }, status);
};
export class SmileIdProvider implements VerificationProvider {
  readonly id = "smile-id";
  readonly mode: Mode;
  readonly captureOrigins: readonly string[];
  readonly identityCountries = supportedCountries;
  readonly bankCountries = [];
  readonly bankPolicyVersion = "unavailable";
  readonly disclosure: { version: string; url: string };
  #config: Config;
  #db: Database;
  #client: SmileIdClient;
  #settings: ReturnType<typeof smileIdCallbackSettings>;
  #credentialDigest: string;
  #proofClients = new Map<string, SmileIdClient>();

  constructor(config: Config, db: Database, transport?: typeof fetch) {
    if (transport && config.NODE_ENV !== "test")
      throw new Error("Test transport is test-only");
    this.#config = config;
    this.#db = db;
    const client = configuredSmileIdClient(config, transport);
    if (!client)
      throw new ConfigurationError("Configure Smile ID credentials first.");
    this.#client = client;
    this.mode = client.mode;
    this.#settings = smileIdCallbackSettings(config);
    this.captureOrigins = [config.APP_ORIGIN];
    const url =
      config.PRIVACY_URL ||
      (this.mode === "sandbox" ? config.APP_ORIGIN + "/policies" : "");
    if (!url.startsWith("https://"))
      throw new ConfigurationError(
        "Smile ID requires a configured privacy notice URL.",
      );
    this.disclosure = {
      url,
      version:
        "smile-id-v3-" + hash(url + "|" + config.TERMS_VERSION).slice(0, 12),
    };
    this.#credentialDigest = digest(
      config.DATA_ENCRYPTION_KEY,
      `smile-id:${this.mode}:${config.SMILE_ID_PARTNER_ID}:${config.SMILE_ID_API_KEY}`,
    );
    this.#proofClients.set(this.#credentialDigest, client);
    if (config.SMILE_ID_PREVIOUS_API_KEY) {
      const d = digest(
        config.DATA_ENCRYPTION_KEY,
        `smile-id:${this.mode}:${config.SMILE_ID_PARTNER_ID}:${config.SMILE_ID_PREVIOUS_API_KEY}`,
      );
      this.#proofClients.set(
        d,
        new SmileIdClient({
          partnerId: config.SMILE_ID_PARTNER_ID!,
          apiKey: config.SMILE_ID_PREVIOUS_API_KEY,
          mode: this.mode,
        }),
      );
    }
  }
  webhookRoute() {
    return this.#settings.route;
  }
  #providerUser(userId: string) {
    return "zetmond_" + userId;
  }
  #assertBrowserToken(token: string) {
    // Inspection prevents accidental secret disclosure; JWT claims never authorize KYC.
    try {
      const claims = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          Buffer.from(token.split(".")[1], "base64url"),
        ),
      );
      if (!claims || typeof claims !== "object" || Array.isArray(claims))
        throw new Error();
      const content = JSON.stringify(claims);
      const capability = this.#settings.route.split("/").at(-1)!;
      if (
        content.includes(capability) ||
        content.includes(this.#config.SMILE_ID_API_KEY!)
      )
        throw new Error();
    } catch {
      throw new Error("Unsafe browser token");
    }
  }
  #scope(ctx: any) {
    return digest(
      this.#config.DATA_ENCRYPTION_KEY,
      JSON.stringify([
        ctx.user_id,
        ctx.email,
        ctx.country,
        ctx.disclosure_url,
        ctx.consented_at,
        this.#settings.privateUrl,
      ]),
    );
  }
  async #context(c: Pick<PoolClient, "query">, id: string) {
    const a = (
      await c.query(
        `SELECT a.*,k.user_id,k.current_attempt_id,u.email,u.role,u.email_verified,u.restricted,u.kyc_status FROM identity_attempts a JOIN identity_cases k ON k.id=a.case_id JOIN users u ON u.id=k.user_id WHERE a.id=$1 AND a.provider=$2 AND a.mode=$3`,
        [id, this.id, this.mode],
      )
    ).rows[0];
    if (!a) throw new Error("Unknown Smile ID attempt");
    return a;
  }
  #eligible(a: any, userId?: string) {
    return (
      a.user_id === (userId || a.user_id) &&
      a.current_attempt_id === a.id &&
      a.role === "customer" &&
      isSupportedCountry(a.country) &&
      a.email_verified &&
      !a.restricted &&
      a.kyc_status !== "restricted"
    );
  }
  async identityStart(input: {
    operationId: string;
    country: Country;
    returnUrl: string;
  }): Promise<IdentityResult> {
    await this.#db.tx(async (c) => {
      const a = await this.#context(c, input.operationId);
      if (
        !this.#eligible(a) ||
        a.country !== input.country ||
        !a.consented_at ||
        !a.disclosure_url
      )
        throw new Error("Ineligible capture");
      const initial: IdentityResult = {
        operationId: a.id,
        mode: this.mode,
        revision: 0,
        status: "incomplete",
        capture: {
          url: this.#config.APP_ORIGIN + "/identity/capture?attempt=" + a.id,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      };
      await c.query(
        `INSERT INTO smile_identity_sessions(attempt_id,provider_user_id,mode,credential_digest,scope_digest,checkpoint_payload,checkpoint_digest) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [
          a.id,
          this.#providerUser(a.user_id),
          this.mode,
          this.#credentialDigest,
          this.#scope(a),
          seal(this.#config.DATA_ENCRYPTION_KEY, initial),
          hash(JSON.stringify({ ...initial, revision: 0 })),
        ],
      );
    });
    return this.identityStatus(input.operationId);
  }
  async #checkpoint(
    c: PoolClient,
    row: any,
    next: Omit<IdentityResult, "revision">,
  ): Promise<IdentityResult> {
    const fingerprint = hash(JSON.stringify({ ...next, revision: 0 }));
    if (fingerprint === row.checkpoint_digest)
      return unseal<IdentityResult>(
        this.#config.DATA_ENCRYPTION_KEY,
        row.checkpoint_payload,
      );
    const result = { ...next, revision: Number(row.revision) + 1 };
    await c.query(
      "UPDATE smile_identity_sessions SET revision=$2,checkpoint_payload=$3,checkpoint_digest=$4,updated_at=now() WHERE attempt_id=$1",
      [
        row.attempt_id,
        result.revision,
        seal(this.#config.DATA_ENCRYPTION_KEY, result),
        fingerprint,
      ],
    );
    return result;
  }
  async identityStatus(id: string): Promise<IdentityResult> {
    return this.#db.tx(async (c) => {
      await c.query("SET LOCAL lock_timeout='5s'");
      const a = await this.#context(c, id);
      const row = (
        await c.query(
          "SELECT * FROM smile_identity_sessions WHERE attempt_id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!row) throw new Error("Capture has not been prepared");
      const base = { operationId: id, mode: this.mode };
      const review = () =>
        this.#checkpoint(c, row, {
          ...base,
          status: "under_review",
          reason: "review_required",
        });
      if (this.#scope(a) !== row.scope_digest)
        return this.#checkpoint(c, row, {
          ...base,
          status: "correction_required",
          reason: "review_required",
        });
      const bodies = (
        await c.query(
          "SELECT * FROM smile_identity_callbacks WHERE attempt_id=$1 ORDER BY received_at",
          [id],
        )
      ).rows;
      // Any conflicting verified core is quarantined, including a different job for one attempt.
      if (bodies.length > 1) return review();
      const core = bodies.length
        ? unseal<SmileDocumentCore>(
            this.#config.DATA_ENCRYPTION_KEY,
            bodies[0].result_payload,
          )
        : undefined;
      const jobId = core?.jobId || row.job_id || row.hint_job_id;
      if (!jobId) {
        if (
          row.state === "ready" ||
          (row.state === "minting" && new Date(row.mint_until) < new Date())
        ) {
          const current = unseal<IdentityResult>(
            this.#config.DATA_ENCRYPTION_KEY,
            row.checkpoint_payload,
          );
          if (
            current.capture &&
            new Date(current.capture.expiresAt) > new Date()
          )
            return current;
          return this.#checkpoint(c, row, {
            ...base,
            status: "incomplete",
            capture: {
              url: this.#config.APP_ORIGIN + "/identity/capture?attempt=" + id,
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          });
        }
        if (
          row.state === "issued" &&
          new Date(row.token_expires_at) > new Date()
        )
          return unseal(
            this.#config.DATA_ENCRYPTION_KEY,
            row.checkpoint_payload,
          );
        return review();
      }
      const tracking = await this.#client.getVerificationStatus({
        jobId,
        userId: row.provider_user_id,
      });
      if (tracking.phase === "processing") return review();
      if (!core || core.status !== tracking.status) {
        if (tracking.status === "block")
          return this.#checkpoint(c, row, {
            ...base,
            status: "rejected",
            reason: "review_required",
          });
        await c.query(
          "INSERT INTO smile_identity_replays(attempt_id,job_id,vendor_status) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [id, jobId, tracking.status],
        );
        return review();
      }
      const bound = (
        await c.query(
          "SELECT attempt_id FROM smile_identity_sessions WHERE mode=$1 AND job_id=$2 AND attempt_id<>$3",
          [this.mode, jobId, id],
        )
      ).rowCount;
      if (bound) return review();
      await c.query(
        "UPDATE smile_identity_sessions SET job_id=$2,state='submitted' WHERE attempt_id=$1",
        [id, jobId],
      );
      const result = smileDocumentDecision(core, {
        operationId: id,
        mode: this.mode,
        country: a.country,
        createdAt: new Date(a.created_at),
        policyUrl: a.disclosure_url,
      });
      return this.#checkpoint(c, row, result);
    });
  }
  async browserSession(
    input: BrowserCaptureContext,
  ): Promise<BrowserCaptureSession> {
    const lease = randomUUID();
    const prepared = await this.#db.tx(async (c) => {
      await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        input.userId,
      ]);
      const a = await this.#context(c, input.operationId);
      if (
        !this.#eligible(a, input.userId) ||
        a.status !== "incomplete" ||
        a.email !== input.email ||
        !a.consented_at
      )
        return stop("This verification is no longer available.");
      const row = (
        await c.query(
          "SELECT * FROM smile_identity_sessions WHERE attempt_id=$1 FOR UPDATE",
          [a.id],
        )
      ).rows[0];
      if (!row || row.scope_digest !== this.#scope(a))
        return stop(
          "Your verification details changed. Check your status first.",
        );
      if (
        row.job_id ||
        row.hint_job_id ||
        row.state === "submitted" ||
        row.state === "uncertain"
      )
        return stop(
          "Your verification is already being processed. Check its status.",
        );
      if (
        (
          await c.query(
            "SELECT 1 FROM smile_identity_callbacks WHERE attempt_id=$1 LIMIT 1",
            [a.id],
          )
        ).rowCount
      )
        return stop(
          "Your result is being processed. Check your verification status.",
        );
      if (row.token_payload && new Date(row.token_expires_at) > new Date())
        return {
          a,
          row,
          token: unseal<string>(
            this.#config.DATA_ENCRYPTION_KEY,
            row.token_payload,
          ),
        };
      if (row.state === "issued")
        return stop(
          "Your verification session expired. Check your status before starting another.",
        );
      if (row.state === "minting" && new Date(row.mint_until) > new Date())
        return stop(
          "Your verification session is being prepared. Please check again.",
        );
      if (row.credential_digest !== this.#credentialDigest)
        throw new Error("Capture credentials changed");
      await c.query(
        "UPDATE smile_identity_sessions SET state='minting',mint_lease=$2,mint_until=now()+interval '30 seconds' WHERE attempt_id=$1",
        [a.id, lease],
      );
      return { a, row, token: undefined };
    });
    let token = prepared.token;
    if (!token) {
      const started = Date.now();
      try {
        token = await this.#client.issueDocumentSessionToken({
          operationId: prepared.a.id,
          userId: prepared.row.provider_user_id,
          country: prepared.a.country,
          email: prepared.a.email,
          callbackUrl: this.#settings.privateUrl,
          consent: {
            granted: true,
            granted_at: new Date(prepared.a.consented_at).toISOString(),
            notice_language: "EN",
            notice_privacy_policy_url: prepared.a.disclosure_url,
          },
        });
        this.#assertBrowserToken(token);
      } catch {
        await this.#db.pool.query(
          "UPDATE smile_identity_sessions SET state='ready',mint_lease=NULL,mint_until=NULL WHERE attempt_id=$1 AND mint_lease=$2",
          [input.operationId, lease],
        );
        return stop(
          "The verification service is unavailable. Please try again later.",
          503,
        );
      }
      await this.#db.tx(async (c) => {
        await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
          input.userId,
        ]);
        const a = await this.#context(c, input.operationId);
        if (
          !this.#eligible(a, input.userId) ||
          this.#scope(a) !== prepared.row.scope_digest
        )
          return stop("This verification is no longer current.");
        const r = await c.query(
          "UPDATE smile_identity_sessions SET state='issued',token_payload=$3,token_expires_at=$4,mint_lease=NULL,mint_until=NULL WHERE attempt_id=$1 AND mint_lease=$2 AND mint_until>now() RETURNING attempt_id",
          [
            a.id,
            lease,
            seal(this.#config.DATA_ENCRYPTION_KEY, token),
            new Date(started + 14 * 60000),
          ],
        );
        if (!r.rowCount)
          return stop(
            "Your session preparation expired. Please check its status.",
          );
      });
    }
    this.#assertBrowserToken(token);
    return {
      attemptId: input.operationId,
      token,
      product: "doc_verification",
      environment: this.mode === "live" ? "production" : "sandbox",
      callback_url: this.#settings.publicUrl,
      partner_details: {
        partner_id: this.#config.SMILE_ID_PARTNER_ID!,
        name: "Zetmond",
        logo_url: this.#config.APP_ORIGIN + "/zetmond-logo.png",
        policy_url: prepared.a.disclosure_url,
        theme_color: "#9e7cff",
      },
      partner_params: {
        zetmond_operation_id: input.operationId,
        user_id: prepared.row.provider_user_id,
      },
    };
  }
  async submissionHint(
    input: BrowserCaptureContext & { jobId?: string; providerUserId?: string },
  ) {
    await this.#db.tx(async (c) => {
      await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        input.userId,
      ]);
      const a = await this.#context(c, input.operationId);
      if (
        !this.#eligible(a, input.userId) ||
        (input.jobId &&
          input.providerUserId !== this.#providerUser(input.userId))
      )
        return stop("Submission references do not match this account.");
      const row = (
        await c.query(
          "SELECT * FROM smile_identity_sessions WHERE attempt_id=$1 FOR UPDATE",
          [a.id],
        )
      ).rows[0];
      if (
        !row?.token_payload ||
        row.scope_digest !== this.#scope(a) ||
        ["ready", "minting"].includes(row.state)
      )
        return stop(
          "Open your current verification session before tracking a submission.",
        );
      if (
        input.jobId &&
        ((row.job_id && row.job_id !== input.jobId) ||
          (row.hint_job_id && row.hint_job_id !== input.jobId))
      )
        return stop(
          "A different submission is already being checked. Check your saved status.",
        );
      if (!input.jobId) {
        await c.query(
          "UPDATE smile_identity_sessions SET state='uncertain' WHERE attempt_id=$1 AND state='issued'",
          [a.id],
        );
        return;
      }
      await c.query(
        "UPDATE smile_identity_sessions SET hint_job_id=coalesce(hint_job_id,$2),state=CASE WHEN state='issued' THEN 'submitted' ELSE state END WHERE attempt_id=$1",
        [a.id, input.jobId],
      );
    });
  }
  async #readWebhook(
    raw: Buffer,
    headers: Record<string, string | string[] | undefined>,
    context?: WebhookContext,
    connection: Pick<PoolClient, "query"> = this.#db.pool,
  ) {
    // The hidden URL capability is independent of the timestamp-only HMAC.
    if (context?.route !== this.#settings.route)
      throw new Error("Wrong callback route");
    const core = parseSmileDocumentCallback(raw);
    const row = (
      await connection.query(
        "SELECT s.*,k.user_id FROM smile_identity_sessions s JOIN identity_attempts a ON a.id=s.attempt_id JOIN identity_cases k ON k.id=a.case_id WHERE s.attempt_id=$1 AND a.provider=$2 AND s.mode=$3 AND a.mode=s.mode",
        [core.operationId, this.id, this.mode],
      )
    ).rows[0];
    if (
      !row ||
      !row.token_payload ||
      row.provider_user_id !== core.userId ||
      core.userId !== this.#providerUser(row.user_id)
    )
      throw new Error("Unbound callback");
    const proofClient = this.#proofClients.get(row.credential_digest);
    if (!proofClient)
      throw new Error("Original callback credentials unavailable");
    const proof = proofClient.verifyWebhookSignal(headers, {
      jobId: core.jobId,
      userId: core.userId,
    });
    const coreDigest = hash(
      JSON.stringify({ ...core, consentRecord: undefined }),
    );
    return {
      core,
      coreDigest,
      event: {
        eventId: hash(proof.dedupeKey + ":" + coreDigest),
        operationId: core.operationId,
        mode: this.mode,
      },
    };
  }
  async authenticateWebhook(
    raw: Buffer,
    headers: Record<string, string | string[] | undefined>,
    context?: WebhookContext,
  ): Promise<ProviderEvent> {
    return (await this.#readWebhook(raw, headers, context)).event;
  }
  async persistWebhook(
    c: PoolClient,
    raw: Buffer,
    headers: Record<string, string | string[] | undefined>,
    event: ProviderEvent,
    context?: WebhookContext,
  ) {
    const accepted = await this.#readWebhook(raw, headers, context, c);
    if (accepted.event.eventId !== event.eventId)
      throw new Error("Callback changed");
    await c.query(
      "INSERT INTO smile_identity_callbacks(attempt_id,job_id,core_digest,result_payload) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [
        event.operationId,
        accepted.core.jobId,
        accepted.coreDigest,
        seal(this.#config.DATA_ENCRYPTION_KEY, accepted.core),
      ],
    );
  }
  async dispatchRecovery() {
    const lease = randomUUID();
    const item = await this.#db.tx(async (c) => {
      await c.query(
        "UPDATE smile_identity_replays r SET state='unknown' FROM identity_attempts a WHERE a.id=r.attempt_id AND a.provider=$1 AND a.mode=$2 AND r.state='running' AND r.lease_until<=now()",
        [this.id, this.mode],
      );
      const row = (
        await c.query(
          "SELECT r.* FROM smile_identity_replays r JOIN identity_attempts a ON a.id=r.attempt_id WHERE r.state='queued' AND a.provider=$1 AND a.mode=$2 ORDER BY r.created_at LIMIT 1 FOR UPDATE OF r SKIP LOCKED",
          [this.id, this.mode],
        )
      ).rows[0];
      if (!row) return null;
      const a = await this.#context(c, row.attempt_id);
      if (!this.#eligible(a)) {
        await c.query(
          "UPDATE smile_identity_replays SET state='rejected' WHERE attempt_id=$1 AND job_id=$2 AND vendor_status=$3",
          [row.attempt_id, row.job_id, row.vendor_status],
        );
        return null;
      }
      await c.query(
        "UPDATE smile_identity_replays SET state='running',lease_token=$4,lease_until=now()+interval '2 minutes' WHERE attempt_id=$1 AND job_id=$2 AND vendor_status=$3",
        [row.attempt_id, row.job_id, row.vendor_status, lease],
      );
      return { ...row, userId: this.#providerUser(a.user_id) };
    });
    if (!item) return false;
    let state = "done";
    try {
      await this.#client.replayVerificationWebhook({
        jobId: item.job_id,
        userId: item.userId,
      });
    } catch (error) {
      state =
        error instanceof SmileIdReplayError && error.outcome === "not_queued"
          ? "rejected"
          : "unknown";
    }
    await this.#db.pool.query(
      "UPDATE smile_identity_replays SET state=$4,lease_token=NULL,lease_until=NULL WHERE attempt_id=$1 AND job_id=$2 AND vendor_status=$3 AND lease_token=$5 AND lease_until>now()",
      [item.attempt_id, item.job_id, item.vendor_status, state, lease],
    );
    return true;
  }
  async banks(): Promise<{ code: string; name: string }[]> {
    return [];
  }
  bankField(): never {
    return stop("Bank verification is not configured.", 503);
  }
  async bankStart(): Promise<never> {
    return stop("Bank verification is not configured.", 503);
  }
  async bankStatus(): Promise<never> {
    return stop("Bank verification is not configured.", 503);
  }
}
