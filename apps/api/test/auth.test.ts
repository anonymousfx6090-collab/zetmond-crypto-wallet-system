import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { authenticator } from "otplib";
import { randomBytes, randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { createApp } from "../src/app";
import { ConfigurationError, loadConfig } from "../src/config";
import { migrate } from "../src/migrate";
import { provisionAdmin } from "../src/provision-admin";
import { hash, unseal } from "../src/crypto";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "Set TEST_DATABASE_URL to an isolated database ending in _test. Tests erase its auth tables.",
  );
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: url,
  DATA_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  RATE_LIMIT: "200",
  RESEND_SECONDS: "1",
} as NodeJS.ProcessEnv);
let runtime: Awaited<ReturnType<typeof createApp>>, server: any;
const input = {
  email: "customer@example.com",
  phone: "+2348031234567",
  country: "NG",
  password: "A long test password 34!",
  acceptTerms: true,
  policyVersion: "development-draft",
};
const post = (path: string, body: unknown, cookie?: string) => {
  const r = request(server)
    .post(`/api/${path}`)
    .set("Origin", config.APP_ORIGIN)
    .set("X-Zetmond-Request", "1")
    .send(body);
  if (cookie) r.set("Cookie", cookie);
  return r;
};
const get = (path: string, cookie?: string) => {
  const r = request(server).get(`/api/${path}`);
  if (cookie) r.set("Cookie", cookie);
  return r;
};
const cookie = (r: any) => r.headers["set-cookie"][0].split(";")[0];
async function registered() {
  const r = await post("auth/register", input);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { r, cookie: cookie(r) };
}
async function messages() {
  return (
    await runtime.db.pool.query(
      "SELECT payload FROM delivery_outbox WHERE payload<>'' ORDER BY created_at",
    )
  ).rows.map((r) => unseal<any>(config.DATA_ENCRYPTION_KEY, r.payload));
}
async function contactCode(purpose: "email") {
  const ms = await messages();
  return ms
    .find((m) => m.text.includes(`${purpose} verification code`))
    .text.match(/\b\d{6}\b/)[0];
}
before(async () => {
  await migrate(url!);
  runtime = await createApp(config);
  server = runtime.app.getHttpServer();
});
beforeEach(async () => {
  await runtime.db.pool.query(
    "TRUNCATE users, sessions, challenges, recovery_codes, step_ups, audit_events, delivery_outbox, rate_limits RESTART IDENTITY CASCADE",
  );
});
after(async () => {
  await runtime.close();
});

test("registration persists hashes and country, sends encrypted challenges, and cannot set a role", async () => {
  const bad = await post("auth/register", { ...input, role: "admin" });
  assert.equal(bad.status, 400);
  const { r } = await registered();
  assert.equal(r.body.user.role, "customer");
  assert.equal(r.body.user.currency, "NGN");
  assert.equal(r.body.user.financialAccess, false);
  const u = (await runtime.db.pool.query("SELECT * FROM users")).rows[0];
  assert.match(u.password_hash, /^\$argon2id\$/);
  assert.equal(u.policy_version, "development-draft");
  const s = (await runtime.db.pool.query("SELECT * FROM sessions")).rows[0];
  assert.equal(s.token_hash, hash(decodeURIComponent(cookie(r).split("=")[1])));
  assert.ok(!JSON.stringify(r.body).includes("password_hash"));
  const out = (
    await runtime.db.pool.query("SELECT payload FROM delivery_outbox")
  ).rows;
  assert.equal(out.length, 1);
  assert.ok(!out[0].payload.includes(input.email));
  assert.match(r.headers["set-cookie"][0], /HttpOnly/);
  assert.match(r.headers["set-cookie"][0], /SameSite=Strict/);
});
test("server validates country, phone, terms, and password instead of trusting the form", async () => {
  for (const patch of [
    { country: "US" },
    { phone: "+14155552671" },
    { password: "short" },
    { acceptTerms: false },
    { policyVersion: "old" },
  ])
    assert.equal(
      (await post("auth/register", { ...input, ...patch })).status,
      400,
    );
  assert.equal(
    (await runtime.db.pool.query("SELECT count(*) FROM users")).rows[0].count,
    "0",
  );
});
test("email verifies once without phone verification; KYC and admin APIs remain blocked", async () => {
  const { cookie: c } = await registered();
  for (const purpose of ["email"] as const) {
    const code = await contactCode(purpose);
    assert.equal((await post("auth/verify", { purpose, code }, c)).status, 201);
    assert.equal((await post("auth/verify", { purpose, code }, c)).status, 400);
  }
  const me = await get("auth/me", c);
  assert.equal(me.body.user.state, "kyc_required");
  assert.equal(me.body.user.emailVerified, true);
  assert.equal(me.body.user.phoneVerified, false);
  assert.equal(me.body.user.financialAccess, false);
  assert.equal((await get("account/financial-eligibility", c)).status, 403);
  assert.equal((await get("admin/access", c)).status, 403);
});
test("phone verification endpoints are disabled and never mark a phone verified", async () => {
  const { cookie: c } = await registered();
  assert.equal(
    (await post("auth/resend", { purpose: "phone" }, c)).status,
    400,
  );
  assert.equal(
    (await post("auth/verify", { purpose: "phone", code: "123456" }, c)).status,
    400,
  );
  assert.equal((await get("auth/me", c)).body.user.phoneVerified, false);
  assert.equal(
    (
      await runtime.db.pool.query(
        "SELECT count(*) FROM delivery_outbox WHERE channel='sms'",
      )
    ).rows[0].count,
    "0",
  );
});
test("email-only migration cancels legacy SMS and consumes phone codes without verifying users", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { r } = await registered();
  await runtime.db.pool.query(
    "INSERT INTO challenges(id,user_id,purpose,digest,expires_at) VALUES($1,$2,'phone','old-code',now()+interval '10 minutes')",
    [randomUUID(), r.body.user.id],
  );
  for (const status of ["queued", "failed", "held"]) {
    await runtime.db.pool.query(
      "INSERT INTO delivery_outbox(id,user_id,channel,payload,status) VALUES($1,$2,'sms','legacy-payload',$3)",
      [randomUUID(), r.body.user.id, status],
    );
  }
  const migration = readFileSync(
    join(__dirname, "../migrations/003_email_only_verification.sql"),
    "utf8",
  );
  await runtime.db.pool.query(migration);
  const sms = (
    await runtime.db.pool.query(
      "SELECT status,payload FROM delivery_outbox WHERE channel='sms'",
    )
  ).rows;
  assert.equal(sms.length, 3);
  assert.ok(
    sms.every((row) => row.status === "cancelled" && row.payload === ""),
  );
  const codes = (
    await runtime.db.pool.query(
      "SELECT consumed_at FROM challenges WHERE purpose='phone'",
    )
  ).rows;
  assert.ok(codes.every((row) => row.consumed_at));
  const user = (
    await runtime.db.pool.query(
      "SELECT email_verified,phone_verified FROM users WHERE id=$1",
      [r.body.user.id],
    )
  ).rows[0];
  assert.deepEqual(user, { email_verified: false, phone_verified: false });
  assert.equal(
    (
      await runtime.db.pool.query(
        "SELECT status FROM delivery_outbox WHERE channel='email'",
      )
    ).rows[0].status,
    "queued",
  );
});
test("financial eligibility requires email and KYC approval, without a phone verification gate", async () => {
  const { cookie: c, r } = await registered();
  // Approval is a fixture in this isolated test database, not a customer-facing bypass.
  await runtime.db.pool.query(
    "UPDATE users SET kyc_status='approved' WHERE id=$1",
    [r.body.user.id],
  );
  assert.equal((await get("account/financial-eligibility", c)).status, 403);
  const code = await contactCode("email");
  assert.equal(
    (await post("auth/verify", { purpose: "email", code }, c)).status,
    201,
  );
  const me = await get("auth/me", c);
  assert.equal(me.body.user.phoneVerified, false);
  assert.equal(me.body.user.state, "customer");
  assert.equal(me.body.user.financialAccess, true);
  assert.equal((await get("account/financial-eligibility", c)).status, 200);
});
test("expired codes and bounded guessing cannot verify contacts", async () => {
  const { cookie: c, r } = await registered();
  const code = await contactCode("email");
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await post("auth/verify", { purpose: "email", code: "000000" }, c))
        .status,
      400,
    );
  assert.equal(
    (await post("auth/verify", { purpose: "email", code }, c)).status,
    400,
  );
  await runtime.db.pool.query(
    "UPDATE challenges SET attempts=0,expires_at=now()-interval '1 second' WHERE user_id=$1",
    [r.body.user.id],
  );
  assert.equal(
    (await post("auth/verify", { purpose: "email", code }, c)).status,
    400,
  );
});
test("password reset is generic, single-use, and revokes every previous session", async () => {
  const { cookie: c } = await registered();
  const login = await post("auth/login", {
    email: input.email,
    password: input.password,
  });
  const c2 = cookie(login);
  const a = await post("auth/forgot-password", { email: input.email }),
    b = await post("auth/forgot-password", { email: "absent@example.com" });
  assert.deepEqual(a.body, b.body);
  const m = (await messages()).find((m) => m.text.includes("#token="));
  const code = m.text.match(/#token=([\w-]+)/)[1];
  const results = await Promise.all([
    post("auth/reset-password", {
      token: code,
      password: "A different safe password 99!",
    }),
    post("auth/reset-password", {
      token: code,
      password: "Another different password 99!",
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
  assert.equal((await get("auth/me", c)).status, 401);
  assert.equal((await get("auth/me", c2)).status, 401);
  assert.equal(
    (await post("auth/login", { email: input.email, password: input.password }))
      .status,
    401,
  );
});
test("sessions are owner-scoped and individual revocation takes effect immediately", async () => {
  const { cookie: c } = await registered();
  const second = await post("auth/login", {
    email: input.email,
    password: input.password,
  });
  const c2 = cookie(second);
  const sessions = await get("auth/sessions", c);
  assert.equal(sessions.body.sessions.length, 2);
  const other = sessions.body.sessions.find((s: any) => !s.current);
  const stranger = await post("auth/register", {
    ...input,
    email: "other@example.com",
    phone: "+2348031234568",
  });
  const sc = cookie(stranger);
  assert.equal(
    (
      await request(server)
        .delete(`/api/auth/sessions/${other.id}`)
        .set("Origin", config.APP_ORIGIN)
        .set("X-Zetmond-Request", "1")
        .set("Cookie", sc)
        .send({})
    ).status,
    404,
  );
  assert.equal(
    (
      await request(server)
        .delete(`/api/auth/sessions/${other.id}`)
        .set("Origin", config.APP_ORIGIN)
        .set("X-Zetmond-Request", "1")
        .set("Cookie", c)
        .send({})
    ).status,
    200,
  );
  assert.equal((await get("auth/me", c2)).status, 401);
  assert.equal((await get("auth/me", c)).status, 200);
});
test("provisioned admins require MFA enrollment, rotate session tokens, and use recovery codes once", async () => {
  await provisionAdmin(url!, {
    email: "admin@example.com",
    password: input.password,
    country: "NG",
  });
  const login = await post("auth/login", {
    email: "admin@example.com",
    password: input.password,
  });
  const old = cookie(login);
  assert.equal(login.body.user.state, "mfa_setup_required");
  assert.equal((await get("admin/access", old)).status, 403);
  const setup = await post("auth/mfa/setup", {}, old);
  assert.equal(setup.status, 201);
  assert.match(setup.body.uri, /otpauth:/);
  const confirm = await post(
    "auth/mfa/confirm",
    { code: authenticator.generate(setup.body.secret) },
    old,
  );
  assert.equal(confirm.status, 201);
  assert.equal(confirm.body.recoveryCodes.length, 8);
  const elevated = cookie(confirm);
  assert.notEqual(old, elevated);
  assert.equal((await get("auth/me", old)).status, 401);
  assert.equal((await get("admin/access", elevated)).status, 200);
  const again = await post("auth/login", {
    email: "admin@example.com",
    password: input.password,
  });
  assert.equal(again.body.user.state, "mfa_required");
  assert.equal(
    (
      await post(
        "auth/mfa/verify",
        { code: authenticator.generate(setup.body.secret) },
        cookie(again),
      )
    ).status,
    400,
    "TOTP replay rejected",
  );
  const recovered = await post(
    "auth/mfa/verify",
    { code: confirm.body.recoveryCodes[0] },
    cookie(again),
  );
  assert.equal(recovered.status, 201);
  const third = await post("auth/login", {
    email: "admin@example.com",
    password: input.password,
  });
  assert.equal(
    (
      await post(
        "auth/mfa/verify",
        { code: confirm.body.recoveryCodes[0] },
        cookie(third),
      )
    ).status,
    400,
  );
});
test("step-up grant binds the exact password change and cannot be replayed", async () => {
  const { cookie: c } = await registered();
  const setup = await post("auth/mfa/setup", {}, c);
  const confirm = await post(
    "auth/mfa/confirm",
    { code: authenticator.generate(setup.body.secret) },
    c,
  );
  const session = cookie(confirm);
  const next = "A new binding password 123!";
  const grant = await post(
    "auth/step-up",
    {
      purpose: "password_change",
      operationDigest: hash(next),
      code: confirm.body.recoveryCodes[0],
    },
    session,
  );
  assert.equal(grant.status, 201);
  assert.equal(
    (
      await post(
        "auth/change-password",
        {
          currentPassword: input.password,
          password: "Wrong bound password 123!",
          stepUpId: grant.body.stepUpId,
        },
        session,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        "auth/change-password",
        {
          currentPassword: input.password,
          password: next,
          stepUpId: grant.body.stepUpId,
        },
        session,
      )
    ).status,
    201,
  );
  assert.equal((await get("auth/me", session)).status, 401);
  const again = await post("auth/login", {
    email: input.email,
    password: next,
  });
  assert.equal(again.status, 201);
});
test("missing or hostile origins cannot mutate account state", async () => {
  assert.equal(
    (await request(server).post("/api/auth/register").send(input)).status,
    403,
  );
  assert.equal(
    (
      await request(server)
        .post("/api/auth/register")
        .set("Origin", "https://evil.example")
        .set("X-Zetmond-Request", "1")
        .send(input)
    ).status,
    403,
  );
  assert.equal(
    (
      await request(server)
        .post("/api/auth/register")
        .set("Origin", config.APP_ORIGIN)
        .send(input)
    ).status,
    403,
  );
});
test("persistent lockout and expired sessions fail closed", async () => {
  const { cookie: c } = await registered();
  for (let i = 0; i < config.LOGIN_ATTEMPTS; i++)
    await post("auth/login", {
      email: input.email,
      password: "wrong password",
    });
  assert.equal(
    (await post("auth/login", { email: input.email, password: input.password }))
      .status,
    401,
  );
  await runtime.db.pool.query(
    "UPDATE sessions SET expires_at=now()-interval '1 second'",
  );
  assert.equal((await get("auth/me", c)).status, 401);
});
test("persisted sessions and challenges survive API restart", async () => {
  const { cookie: c } = await registered();
  const code = await contactCode("email");
  await runtime.close();
  runtime = await createApp(config);
  server = runtime.app.getHttpServer();
  assert.equal((await get("auth/me", c)).status, 200);
  assert.equal(
    (await post("auth/verify", { purpose: "email", code }, c)).status,
    201,
  );
});
test("production rejects development delivery, draft terms and unapproved policy", () => {
  assert.throws(
    () => loadConfig({ ...config, NODE_ENV: "production" } as any),
    /Production/,
  );
  assert.throws(
    () =>
      loadConfig({
        ...config,
        NODE_ENV: "production",
        DELIVERY_MODE: "provider",
        SECURITY_POLICY_APPROVED: "true",
        TERMS_VERSION: "approved-v1",
        TERMS_URL: "https://example.com/terms",
        PRIVACY_URL: "https://example.com/privacy",
      } as any),
    /HTTPS/,
  );
});

test("production accepts configured email delivery without any SMS settings", () => {
  const production = {
    ...config,
    NODE_ENV: "production",
    APP_ORIGIN: "https://customer.example.com",
    DELIVERY_MODE: "provider",
    SECURITY_POLICY_APPROVED: "true",
    TERMS_VERSION: "approved-v1",
    TERMS_URL: "https://example.com/terms",
    PRIVACY_URL: "https://example.com/privacy",
    SMTP_HOST: "smtp.example.com",
    MAIL_FROM: "accounts@example.com",
  };
  assert.doesNotThrow(() => loadConfig(production as any));
  assert.throws(
    () => loadConfig({ ...production, SMTP_HOST: undefined } as any),
    /configured email delivery/,
  );
  assert.throws(
    () =>
      loadConfig({ ...production, SECURITY_POLICY_APPROVED: "false" } as any),
    /Production/,
  );
});

test("production configuration reports all incomplete settings by name", () => {
  assert.throws(
    () => loadConfig({ ...config, NODE_ENV: "production" } as any),
    (error: unknown) => {
      assert.ok(error instanceof ConfigurationError);
      for (const field of [
        "DELIVERY_MODE",
        "SECURITY_POLICY_APPROVED",
        "TERMS_VERSION",
        "TERMS_URL",
        "PRIVACY_URL",
        "APP_ORIGIN",
        "SMTP_HOST",
        "MAIL_FROM",
      ]) {
        assert.ok(error.message.includes(field), `Reports ${field}`);
      }
      assert.ok(!error.message.includes(config.DATABASE_URL));
      assert.ok(!error.message.includes(config.DATA_ENCRYPTION_KEY));
      return true;
    },
  );
});

const stagingSettings = () => ({
  ...config,
  NODE_ENV: "production",
  DEPLOYMENT_STAGE: "staging",
  APP_ORIGIN: "https://staging.example.com",
  DELIVERY_MODE: "provider",
  SMTP_HOST: "smtp.example.com",
  MAIL_FROM: "accounts@example.com",
});

test("explicit staging accepts pending policies without marking them approved", () => {
  const staged = loadConfig(stagingSettings() as any);
  assert.equal(staged.NODE_ENV, "production");
  assert.equal(staged.DEPLOYMENT_STAGE, "staging");
  assert.equal(staged.SECURITY_POLICY_APPROVED, "false");
  assert.equal(staged.TERMS_VERSION, "development-draft");
  assert.equal(staged.TERMS_URL, undefined);
  assert.equal(staged.PRIVACY_URL, undefined);
  assert.throws(
    () =>
      loadConfig({ ...stagingSettings(), DEPLOYMENT_STAGE: undefined } as any),
    /SECURITY_POLICY_APPROVED/,
  );
});

test("staging retains hosted security and delivery configuration checks", () => {
  for (const [field, value] of [
    ["NODE_ENV", "development"],
    ["APP_ORIGIN", "http://staging.example.com"],
    ["DELIVERY_MODE", "development"],
    ["SMTP_HOST", undefined],
    ["MAIL_FROM", undefined],
    ["DEPLOYMENT_STAGE", "stagng"],
  ] as const) {
    assert.throws(
      () => loadConfig({ ...stagingSettings(), [field]: value } as any),
      new RegExp(field),
    );
  }
});

test("hosted staging uses secure sessions and denies financial access even after email and KYC approval", async () => {
  const stagedConfig = loadConfig(stagingSettings() as any);
  const staged = await createApp(stagedConfig);
  const stagedServer = staged.app.getHttpServer();
  const stagedPost = (path: string, body: unknown, session?: string) => {
    const req = request(stagedServer)
      .post(`/api/${path}`)
      .set("Origin", stagedConfig.APP_ORIGIN)
      .set("X-Zetmond-Request", "1")
      .send(body);
    if (session) req.set("Cookie", session);
    return req;
  };
  try {
    const health = await request(stagedServer).get("/api/health");
    assert.deepEqual(health.body, { status: "ok", deploymentStage: "staging" });
    const policy = await request(stagedServer).get("/api/auth/policy");
    assert.equal(policy.body.deploymentStage, "staging");
    assert.equal(policy.body.development, false);
    const registered = await stagedPost("auth/register", input);
    assert.equal(registered.status, 201);
    assert.match(
      registered.headers["set-cookie"][0],
      /^__Host-zetmond_session=/,
    );
    assert.match(registered.headers["set-cookie"][0], /; Secure/);
    assert.match(registered.headers["set-cookie"][0], /HttpOnly/);
    const session = cookie(registered);
    const verified = await stagedPost(
      "auth/verify",
      { purpose: "email", code: await contactCode("email") },
      session,
    );
    assert.equal(verified.status, 201);
    // Fixture approval is confined to the isolated test database.
    await staged.db.pool.query(
      "UPDATE users SET kyc_status='approved' WHERE id=$1",
      [registered.body.user.id],
    );
    const me = await request(stagedServer)
      .get("/api/auth/me")
      .set("Cookie", session);
    assert.equal(me.body.user.emailVerified, true);
    assert.equal(me.body.user.kycStatus, "approved");
    assert.equal(me.body.user.financialAccess, false);
    const financial = await request(stagedServer)
      .get("/api/account/financial-eligibility")
      .set("Cookie", session);
    assert.equal(financial.status, 403);
    assert.match(financial.body.message, /test environment/);
    assert.equal(
      (
        await request(stagedServer)
          .get("/api/admin/access")
          .set("Cookie", session)
      ).status,
      403,
    );
    const loggedOut = await stagedPost("auth/logout", {}, session);
    assert.equal(loggedOut.status, 201);
    assert.match(
      loggedOut.headers["set-cookie"][0],
      /^__Host-zetmond_session=/,
    );
    assert.match(loggedOut.headers["set-cookie"][0], /; Secure/);
    assert.equal(
      (await request(stagedServer).get("/api/auth/me").set("Cookie", session))
        .status,
      401,
    );
  } finally {
    await staged.close();
  }
});

test("invalid configuration reports field names without exposing supplied secrets", () => {
  const secret = "private-value-do-not-log";
  assert.throws(
    () =>
      loadConfig({
        ...config,
        DATA_ENCRYPTION_KEY: secret,
        SMTP_PORT: secret,
      } as any),
    (error: unknown) => {
      assert.ok(error instanceof ConfigurationError);
      assert.ok(error.message.includes("DATA_ENCRYPTION_KEY"));
      assert.ok(error.message.includes("SMTP_PORT"));
      assert.ok(!error.message.includes(secret));
      assert.ok(!error.message.includes(config.DATABASE_URL));
      return true;
    },
  );
});

test("email provider delivery retries failure and does not mistake delivery for verification", async (t) => {
  const { Delivery } = await import("../src/delivery/delivery.service");
  let successful = false,
    received = 0;
  t.mock.method(nodemailer, "createTransport", ((options: any) => {
    assert.equal(options.requireTLS, true);
    return {
      sendMail: async (message: any) => {
        received++;
        assert.equal(message.to, input.email);
        assert.equal(message.from, "accounts@example.com");
        if (!successful) throw new Error("Temporary SMTP failure");
        return { accepted: [message.to] };
      },
    };
  }) as any);
  const delivery = new Delivery(runtime.db, {
    ...config,
    DELIVERY_MODE: "provider",
    SMTP_HOST: "smtp.example.com",
    MAIL_FROM: "accounts@example.com",
  });
  try {
    const { r } = await registered();
    // SMTP is stubbed locally; no real messages or provider credentials are used.
    await delivery.dispatch();
    let out = (
      await runtime.db.pool.query(
        "SELECT * FROM delivery_outbox WHERE channel='email'",
      )
    ).rows[0];
    assert.equal(out.status, "queued");
    assert.equal(out.attempts, 1);
    successful = true;
    await runtime.db.pool.query(
      "UPDATE delivery_outbox SET next_attempt_at=now() WHERE channel='email'",
    );
    await delivery.dispatch();
    out = (
      await runtime.db.pool.query(
        "SELECT * FROM delivery_outbox WHERE channel='email'",
      )
    ).rows[0];
    assert.equal(out.status, "delivered");
    assert.equal(out.payload, "");
    assert.equal(received, 2);
    assert.equal(
      (
        await runtime.db.pool.query(
          "SELECT email_verified FROM users WHERE id=$1",
          [r.body.user.id],
        )
      ).rows[0].email_verified,
      false,
    );
  } finally {
    t.mock.restoreAll();
  }
});

test("expired verification messages are cleared without being delivered", async () => {
  await registered();
  await runtime.db.pool.query(
    "UPDATE delivery_outbox SET expires_at=now()-interval '1 second'",
  );
  await runtime.delivery.dispatch();
  const rows = (
    await runtime.db.pool.query("SELECT status,payload FROM delivery_outbox")
  ).rows;
  assert.equal(rows.length, 1);
  for (const row of rows) {
    assert.equal(row.status, "expired");
    assert.equal(row.payload, "");
  }
});

test("rate limits are shared across requests and cannot be reset by creating a new session", async () => {
  for (let i = 0; i < config.RATE_LIMIT; i++)
    assert.equal(await runtime.auth.rate("a-persistent-client"), true);
  assert.equal(await runtime.auth.rate("a-persistent-client"), false);
  await runtime.close();
  runtime = await createApp(config);
  server = runtime.app.getHttpServer();
  assert.equal(await runtime.auth.rate("a-persistent-client"), false);
});
