import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import request from "supertest";
import { loadConfig, ConfigurationError } from "../src/config";
import { Database } from "../src/db";
import { migrate } from "../src/migrate";
import { createApp } from "../src/app";
import { unseal } from "../src/crypto";
import { SmileIdProvider } from "../src/providers/smile-id.provider";
import { configuredVerificationProviders } from "../src/providers/registry";
import { smileIdCallbackSettings } from "../src/providers/smile-id.settings";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("A dedicated TEST_DATABASE_URL ending in _test is required");
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: url,
  DATA_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  APP_ORIGIN: "https://app.example.test",
  PUBLIC_API_ORIGIN: "https://api.example.test",
  SMILE_ID_PARTNER_ID: "123",
  SMILE_ID_API_KEY: "fixture-smile-key",
  RATE_LIMIT: "1000",
});
const db = new Database(url);
let runtime: Awaited<ReturnType<typeof createApp>> | undefined,
  provider: SmileIdProvider,
  server: any;
let tokenRequests = 0,
  replayRequests = 0,
  index = 0,
  replayLost = false,
  exposeCallback = false;
let holdToken: Promise<void> | undefined;
const scopes: any[] = [],
  jobs = new Map<string, any>();
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
const jwt = (claims: unknown) =>
  [
    Buffer.from('{"alg":"HS256"}').toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    Buffer.from("fixture-signature").toString("base64url"),
  ].join(".");
const transport: typeof fetch = async (target, opts) => {
  const path = new URL(String(target)).pathname;
  if (path === "/v3/token") {
    if (opts?.body instanceof FormData) {
      tokenRequests++;
      const f = opts.body,
        payload = JSON.parse(String(f.get("payload")));
      const scope = {
        user_id: f.get("user_id"),
        product: f.get("product"),
        partner_params: JSON.parse(String(f.get("partner_params"))),
        payload,
      };
      scopes.push(scope);
      if (holdToken) await holdToken;
      return json({
        token: jwt({
          user_id: scope.user_id,
          country: payload.country,
          callback_url: exposeCallback
            ? payload.callback_url
            : "callback_fixture_reference",
          email: "pii_fixture_reference",
        }),
      });
    }
    return json({ token: jwt({ fixture: "server-lookup" }) });
  }
  const id = path.split("/").at(-1)!;
  const job = jobs.get(id);
  if (!job) return json({ status: "not_found" }, 404);
  if (path.startsWith("/v3/status/"))
    return json(
      {
        status: job.status,
        job_id: id,
        user_id: job.userId,
        message: "fixture",
        created_at: new Date().toISOString(),
      },
      job.status === "processing" ? 202 : 200,
    );
  if (path.startsWith("/v3/replay/")) {
    replayRequests++;
    if (replayLost) throw new Error("fixture lost replay response");
    return json(
      {
        status: "accepted",
        job_id: id,
        user_id: job.userId,
        message: "fixture queued",
      },
      202,
    );
  }
  assert.fail("Unexpected vendor request");
};
const post = (path: string, body: unknown, cookie?: string) => {
  const r = request(server)
    .post("/api/" + path)
    .set("Origin", config.APP_ORIGIN)
    .set("X-Zetmond-Request", "1")
    .send(body);
  return cookie ? r.set("Cookie", cookie) : r;
};
const get = (path: string, cookie: string) =>
  request(server)
    .get("/api/" + path)
    .set("Cookie", cookie);
async function customer(verify = true) {
  const email = `smile-integration-${++index}@example.test`;
  const r = await post("auth/register", {
    email,
    phone: "+234803" + String(index).padStart(7, "0"),
    country: "NG",
    password: "Long verification fixture password!",
    acceptTerms: true,
    policyVersion: "development-draft",
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const actor = {
    id: r.body.user.id,
    cookie: r.headers["set-cookie"][0].split(";")[0],
    email,
  };
  if (verify)
    await db.pool.query("UPDATE users SET email_verified=true WHERE id=$1", [
      actor.id,
    ]);
  return actor;
}
async function prepared(actor: Awaited<ReturnType<typeof customer>>) {
  const r = await post(
    "identity/sessions",
    { disclosureVersion: provider.disclosure.version },
    actor.cookie,
  );
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.attemptId as string;
  await pump(id, "incomplete");
  return id;
}
async function pump(id: string, status: string) {
  for (let n = 0; n < 20; n++) {
    const row = (
      await db.pool.query("SELECT status FROM identity_attempts WHERE id=$1", [
        id,
      ])
    ).rows[0];
    if (row?.status === status) return;
    await db.pool.query(
      "UPDATE verification_jobs SET run_at=now() WHERE target_id=$1",
      [id],
    );
    await runtime!.verificationWorker.dispatch();
  }
  assert.equal(
    (
      await db.pool.query("SELECT status FROM identity_attempts WHERE id=$1", [
        id,
      ])
    ).rows[0].status,
    status,
  );
}
async function bodyFor(
  actor: Awaited<ReturnType<typeof customer>>,
  id: string,
  patch: any = {},
) {
  const capture = await post(
    "identity/capture",
    { attemptId: id },
    actor.cookie,
  );
  assert.equal(capture.status, 201, JSON.stringify(capture.body));
  const created = (
    await db.pool.query(
      "SELECT created_at FROM identity_attempts WHERE id=$1",
      [id],
    )
  ).rows[0].created_at as Date;
  const jobId = "job_" + String(++index).padStart(26, "0");
  const body: any = {
    product: "document_verification",
    status: "clear",
    reason: null,
    created_at: new Date(created.getTime() + 1).toISOString(),
    completed_at: new Date(created.getTime() + 2).toISOString(),
    partner_params: {
      zetmond_operation_id: id,
      job_id: jobId,
      user_id: "zetmond_" + actor.id,
    },
    id_fields: {
      full_name: "Fixture Adult",
      country: "NG",
      date_of_birth: "1992-08-22",
      expiration_date: "2031-01-15",
      issuance_date: "2021-01-15",
      is_deceased: false,
    },
    antifraud: {
      fraud_risk: { risk_level: "low", risk_score: 0, risk_indicators: [] },
      summary: { fraud_detected: false, fraud_sources: [] },
      smile_secure: { status: "clear", suspect_users: [] },
    },
    consent: {
      privacy_notice: provider.disclosure.url,
      record_id: "fixture-record",
    },
    image_links: { selfie_image: "https://private.example.test/do-not-retain" },
    device_signals: { location: "do-not-retain" },
    ...patch,
  };
  jobs.set(jobId, { status: body.status, userId: body.partner_params.user_id });
  return body;
}
function deliver(
  body: any,
  options: {
    route?: string;
    signature?: string;
    timestamp?: string;
    key?: string;
    userId?: string;
  } = {},
) {
  const timestamp = options.timestamp || new Date().toISOString();
  const signature =
    options.signature ||
    createHmac("sha256", options.key || config.SMILE_ID_API_KEY!)
      .update(timestamp + config.SMILE_ID_PARTNER_ID + "sid_request")
      .digest("base64");
  return request(server)
    .post(options.route || provider.webhookRoute())
    .set("Content-Type", "application/json")
    .set("Response-Timestamp", timestamp)
    .set("Response-Signature", signature)
    .set("smileid-job-id", body.partner_params.job_id)
    .set("user-id", options.userId || body.partner_params.user_id)
    .send(JSON.stringify(body));
}
before(async () => {
  await migrate(url);
});
beforeEach(async () => {
  if (runtime) await runtime.close();
  await db.pool.query("TRUNCATE users,rate_limits RESTART IDENTITY CASCADE");
  tokenRequests = 0;
  replayRequests = 0;
  replayLost = false;
  exposeCallback = false;
  holdToken = undefined;
  scopes.length = 0;
  jobs.clear();
  provider = new SmileIdProvider(config, db, transport);
  runtime = await createApp(config, [provider]);
  server = runtime.app.getHttpServer();
});
after(async () => {
  await runtime?.close();
  await db.close();
});

test("capture requires a current owned, email-verified session and preserves CSRF", async () => {
  assert.equal(
    (
      await post("identity/capture", {
        attemptId: "79d95e70-bf87-4e4d-a6a5-4e9c0f69a373",
      })
    ).status,
    401,
  );
  const unverified = await customer(false);
  assert.equal(
    (
      await post(
        "identity/capture",
        { attemptId: "79d95e70-bf87-4e4d-a6a5-4e9c0f69a373" },
        unverified.cookie,
      )
    ).status,
    403,
  );
  const a = await customer(),
    id = await prepared(a),
    other = await customer();
  assert.equal(
    (await post("identity/capture", { attemptId: id }, other.cookie)).status,
    409,
  );
  assert.equal(
    (
      await request(server)
        .post("/api/identity/capture")
        .set("Cookie", a.cookie)
        .send({ attemptId: id })
    ).status,
    403,
  );
  assert.equal(tokenRequests, 0);
});
test("one persisted capture token resumes across requests without exposing API key or private callback URL", async () => {
  const a = await customer(),
    id = await prepared(a);
  const r = await post("identity/capture", { attemptId: id }, a.cookie);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.product, "doc_verification");
  assert.equal(r.body.environment, "sandbox");
  assert.equal(
    r.body.callback_url,
    "https://api.example.test/api/webhooks/smile-id",
  );
  assert.ok(!r.text.includes(config.SMILE_ID_API_KEY!));
  assert.ok(!r.text.includes(provider.webhookRoute()));
  assert.ok(!JSON.stringify(provider).includes(config.SMILE_ID_API_KEY!));
  assert.equal(
    scopes[0].payload.callback_url,
    smileIdCallbackSettings(config).privateUrl,
  );
  assert.equal(scopes[0].payload.email, a.email);
  assert.equal(scopes[0].payload.country, "NG");
  assert.equal(scopes[0].payload.consent.granted, true);
  assert.equal(
    scopes[0].payload.consent.notice_privacy_policy_url,
    provider.disclosure.url,
  );
  const row = (
    await db.pool.query(
      "SELECT * FROM smile_identity_sessions WHERE attempt_id=$1",
      [id],
    )
  ).rows[0];
  assert.ok(!row.token_payload.includes(r.body.token));
  assert.equal(
    unseal(config.DATA_ENCRYPTION_KEY, row.token_payload),
    r.body.token,
  );
  const again = await post("identity/capture", { attemptId: id }, a.cookie);
  assert.equal(again.body.token, r.body.token);
  assert.equal(tokenRequests, 1);
});
test("concurrent tabs cannot mint parallel tokens for the same attempt", async () => {
  const a = await customer(),
    id = await prepared(a);
  let release!: () => void;
  holdToken = new Promise((resolve) => {
    release = resolve;
  });
  const first = post("identity/capture", { attemptId: id }, a.cookie).then(
    (r) => r,
  );
  for (let n = 0; n < 100 && tokenRequests === 0; n++)
    await new Promise((r) => setTimeout(r, 10));
  assert.equal(tokenRequests, 1);
  const second = await post("identity/capture", { attemptId: id }, a.cookie);
  assert.equal(second.status, 409);
  release();
  assert.equal((await first).status, 201);
  assert.equal(tokenRequests, 1);
});
test("browser hints require an issued session and tokens exposing the private callback are never returned", async () => {
  const a = await customer(),
    id = await prepared(a);
  assert.equal(
    (await post("identity/capture/submission", { attemptId: id }, a.cookie))
      .status,
    409,
  );
  exposeCallback = true;
  const unsafe = await post("identity/capture", { attemptId: id }, a.cookie);
  assert.equal(unsafe.status, 503);
  assert.ok(!unsafe.text.includes(provider.webhookRoute()));
  const row = (
    await db.pool.query(
      "SELECT token_payload,state FROM smile_identity_sessions WHERE attempt_id=$1",
      [id],
    )
  ).rows[0];
  assert.equal(row.token_payload, null);
  assert.equal(row.state, "ready");
});
test("browser submission stays pending; authenticated callback reconciles canonical status and stores minimal encrypted evidence", async () => {
  const a = await customer(),
    id = await prepared(a);
  await post("identity/capture", { attemptId: id }, a.cookie);
  const body = await bodyFor(a, id);
  const submitted = await post(
    "identity/capture/submission",
    {
      attemptId: id,
      jobId: body.partner_params.job_id,
      userId: body.partner_params.user_id,
    },
    a.cookie,
  );
  assert.equal(submitted.status, 201);
  assert.notEqual(submitted.body.status, "approved");
  const callback = await deliver(body);
  assert.equal(callback.status, 200, JSON.stringify(callback.body));
  await pump(id, "approved");
  const view = await get("identity", a.cookie);
  assert.equal(view.body.status, "approved");
  assert.equal(view.body.mode, "sandbox");
  const stored = (
    await db.pool.query(
      "SELECT result_payload FROM smile_identity_callbacks WHERE attempt_id=$1",
      [id],
    )
  ).rows[0].result_payload;
  assert.ok(!stored.includes("Fixture Adult"));
  const projection = JSON.stringify(unseal(config.DATA_ENCRYPTION_KEY, stored));
  assert.ok(!projection.includes("do-not-retain"));
  assert.ok(!projection.includes("image_links"));
  assert.ok(!projection.includes("device_signals"));
});
test("duplicate deliveries and mutable receipt links do not create conflicting decisions", async () => {
  const a = await customer(),
    id = await prepared(a),
    body = await bodyFor(a, id);
  assert.equal((await deliver(body)).status, 200);
  await pump(id, "approved");
  const revision = (
    await db.pool.query("SELECT revision FROM identity_attempts WHERE id=$1", [
      id,
    ])
  ).rows[0].revision;
  assert.equal(
    (
      await deliver(
        {
          ...body,
          image_links: { selfie_image: "https://another.example.test/changed" },
        },
        { timestamp: new Date(Date.now() + 1).toISOString() },
      )
    ).status,
    200,
  );
  await runtime!.verificationWorker.dispatch();
  assert.equal(
    (
      await db.pool.query(
        "SELECT count(*) FROM smile_identity_callbacks WHERE attempt_id=$1",
        [id],
      )
    ).rows[0].count,
    "1",
  );
  assert.equal(
    (
      await db.pool.query(
        "SELECT revision FROM identity_attempts WHERE id=$1",
        [id],
      )
    ).rows[0].revision,
    revision,
  );
});
test("private route capability, original proof, freshness, product and ownership are all required", async () => {
  const a = await customer(),
    id = await prepared(a),
    body = await bodyFor(a, id);
  assert.notEqual(
    (await deliver(body, { route: "/api/webhooks/smile-id" })).status,
    200,
  );
  assert.equal(
    (await deliver(body, { signature: "0".repeat(43) + "=" })).status,
    401,
  );
  assert.equal(
    (
      await deliver(body, {
        timestamp: new Date(Date.now() - 6 * 60000).toISOString(),
      })
    ).status,
    401,
  );
  assert.equal((await deliver(body, { userId: "another-user" })).status, 401);
  assert.equal(
    (await deliver({ ...body, product: "smart_selfie_registration" })).status,
    401,
  );
  const other = await customer(),
    otherId = await prepared(other);
  assert.equal(
    (
      await deliver({
        ...body,
        partner_params: {
          ...body.partner_params,
          zetmond_operation_id: otherId,
        },
      })
    ).status,
    401,
  );
  assert.equal(
    (await db.pool.query("SELECT count(*) FROM smile_identity_callbacks"))
      .rows[0].count,
    "0",
  );
});
test("age, country, expiry and contradictory clear/fraud evidence preserve KYC gates", async () => {
  for (const [patch, expected] of [
    [
      {
        id_fields: {
          full_name: "Fixture Child",
          country: "NG",
          date_of_birth: "2015-08-22",
          expiration_date: "2031-01-15",
        },
      },
      "rejected",
    ],
    [
      {
        id_fields: {
          full_name: "Fixture Adult",
          country: "GH",
          date_of_birth: "1992-08-22",
          expiration_date: "2031-01-15",
        },
      },
      "rejected",
    ],
    [
      {
        id_fields: {
          full_name: "Fixture Adult",
          country: "NG",
          date_of_birth: "1992-08-22",
          expiration_date: "2020-01-15",
        },
      },
      "correction_required",
    ],
    [
      {
        antifraud: {
          fraud_risk: {
            risk_level: "high",
            risk_score: 100,
            risk_indicators: ["fixture-risk"],
          },
          summary: { fraud_detected: false },
          smile_secure: { status: "clear", suspect_users: [] },
        },
      },
      "under_review",
    ],
    [{ id_fields: null }, "under_review"],
  ] as const) {
    const a = await customer(),
      id = await prepared(a),
      body = await bodyFor(a, id, patch);
    assert.equal((await deliver(body)).status, 200);
    await pump(id, expected);
    assert.notEqual((await get("identity", a.cookie)).body.status, "approved");
  }
});
test("conflicting verified cores quarantine a previous approval rather than overwriting identity", async () => {
  const a = await customer(),
    id = await prepared(a),
    body = await bodyFor(a, id);
  await deliver(body);
  await pump(id, "approved");
  await deliver({
    ...body,
    id_fields: { ...body.id_fields, full_name: "Different Fixture Identity" },
  });
  await pump(id, "under_review");
  assert.equal((await get("auth/me", a.cookie)).body.user.kycStatus, "pending");
  const history = (
    await db.pool.query(
      "SELECT status FROM verification_decisions WHERE target_id=$1 ORDER BY revision",
      [id],
    )
  ).rows.map((r) => r.status);
  assert.ok(history.includes("approved"));
  assert.equal(history.at(-1), "under_review");
});
test("callbacks for a replaced attempt cannot approve its replacement", async () => {
  const a = await customer(),
    first = await prepared(a),
    body = await bodyFor(a, first, {
      reason: "document_expired",
      status: "attention",
    });
  await deliver(body);
  await pump(first, "correction_required");
  const r = await post(
    "identity/resubmissions",
    { disclosureVersion: provider.disclosure.version },
    a.cookie,
  );
  assert.equal(r.status, 201);
  const next = r.body.attemptId;
  assert.notEqual(next, first);
  jobs.get(body.partner_params.job_id).status = "clear";
  await deliver({ ...body, status: "clear", reason: null });
  await pump(next, "incomplete");
  await runtime!.verificationWorker.dispatch();
  const view = await get("identity", a.cookie);
  assert.equal(view.body.attemptId, next);
  assert.notEqual(view.body.status, "approved");
});
test("missing callbacks queue one durable replay; an uncertain replay is not blindly repeated", async () => {
  const a = await customer(),
    id = await prepared(a),
    body = await bodyFor(a, id);
  await post(
    "identity/capture/submission",
    {
      attemptId: id,
      jobId: body.partner_params.job_id,
      userId: body.partner_params.user_id,
    },
    a.cookie,
  );
  await pump(id, "under_review");
  replayLost = true;
  await runtime!.verificationWorker.dispatch();
  assert.equal(replayRequests, 1);
  assert.equal(
    (
      await db.pool.query(
        "SELECT state FROM smile_identity_replays WHERE attempt_id=$1",
        [id],
      )
    ).rows[0].state,
    "unknown",
  );
  await post("identity/refresh", {}, a.cookie);
  await runtime!.verificationWorker.dispatch();
  await runtime!.verificationWorker.dispatch();
  assert.equal(replayRequests, 1);
  assert.notEqual((await get("identity", a.cookie)).body.status, "approved");
});
test("saved tokens survive provider/API restart; expired or revoked sessions cannot mint replacements", async () => {
  const a = await customer(),
    id = await prepared(a),
    first = await post("identity/capture", { attemptId: id }, a.cookie);
  await runtime!.close();
  provider = new SmileIdProvider(config, db, transport);
  runtime = await createApp(config, [provider]);
  server = runtime.app.getHttpServer();
  assert.equal(
    (await post("identity/capture", { attemptId: id }, a.cookie)).body.token,
    first.body.token,
  );
  assert.equal(tokenRequests, 1);
  await db.pool.query(
    "UPDATE smile_identity_sessions SET token_expires_at=now()-interval '1 second' WHERE attempt_id=$1",
    [id],
  );
  assert.equal(
    (await post("identity/capture", { attemptId: id }, a.cookie)).status,
    409,
  );
  assert.equal(tokenRequests, 1);
  await db.pool.query("UPDATE sessions SET revoked_at=now() WHERE user_id=$1", [
    a.id,
  ]);
  assert.equal(
    (await post("identity/capture", { attemptId: id }, a.cookie)).status,
    401,
  );
});
test("key rotation keeps the callback route stable and requires the original key for outstanding attempts", async () => {
  const a = await customer(),
    id = await prepared(a),
    body = await bodyFor(a, id);
  const originalRoute = provider.webhookRoute();
  const rotated = { ...config, SMILE_ID_API_KEY: "fixture-rotated-key" };
  await runtime!.close();
  provider = new SmileIdProvider(rotated, db, transport);
  runtime = await createApp(rotated, [provider]);
  server = runtime.app.getHttpServer();
  assert.equal(provider.webhookRoute(), originalRoute);
  assert.equal((await deliver(body)).status, 401);
  await runtime.close();
  const retainingPrevious = {
    ...rotated,
    SMILE_ID_PREVIOUS_API_KEY: config.SMILE_ID_API_KEY,
  };
  provider = new SmileIdProvider(retainingPrevious, db, transport);
  runtime = await createApp(retainingPrevious, [provider]);
  server = runtime.app.getHttpServer();
  assert.equal((await deliver(body)).status, 200);
  await pump(id, "approved");
  assert.equal(tokenRequests, 1);
});
test("registry is opt-in and callback settings reject non-HTTPS origins", () => {
  assert.equal(configuredVerificationProviders(config, db).length, 0);
  assert.throws(
    () =>
      smileIdCallbackSettings({
        ...config,
        PUBLIC_API_ORIGIN: "http://127.0.0.1:4100",
      }),
    ConfigurationError,
  );
  assert.equal(
    configuredVerificationProviders(
      { ...config, SMILE_ID_ENABLED: "true" },
      db,
    )[0].id,
    "smile-id",
  );
});
