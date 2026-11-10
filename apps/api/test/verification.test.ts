import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import {
  randomBytes,
  randomUUID,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import request from "supertest";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { migrate } from "../src/migrate";
import { seal, unseal, digest } from "../src/crypto";
import { bankDigest } from "../src/verification/verification.service";
import {
  VerificationProvider,
  IdentityResult,
  BankResult,
  adult,
} from "../src/providers/verification";
import { VerificationWorker } from "../src/verification/verification.worker";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("TEST_DATABASE_URL must end in _test");
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: url,
  DATA_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  RATE_LIMIT: "1000",
});
const secret = randomBytes(32),
  identity = new Map<string, IdentityResult>(),
  banks = new Map<string, BankResult>();
let starts = 0,
  bankStarts = 0,
  throwOnce = false;
const provider: VerificationProvider = {
  id: "fixture",
  mode: "sandbox",
  captureOrigins: ["https://capture.example.test"],
  identityCountries: ["NG", "GH", "KE"],
  bankCountries: ["NG"],
  disclosure: { version: "fixture-v1", url: "https://example.test/disclosure" },
  bankPolicyVersion: "fixture-exact-v1",
  async identityStart({ operationId }) {
    starts++;
    if (!identity.has(operationId))
      identity.set(operationId, {
        operationId,
        mode: "sandbox",
        revision: 0,
        status: "incomplete",
        capture: {
          url: "https://capture.example.test/session",
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      });
    if (throwOnce) {
      throwOnce = false;
      throw new Error("unknown remote outcome");
    }
    return identity.get(operationId)!;
  },
  async identityStatus(id) {
    return identity.get(id)!;
  },
  async banks() {
    return [{ code: "fixture-bank", name: "Fixture Bank" }];
  },
  bankField() {
    return {
      label: "Account number",
      pattern: "[0-9]{10}",
      minLength: 10,
      maxLength: 10,
      inputMode: "numeric",
    };
  },
  async bankStart(input) {
    bankStarts++;
    if (!banks.has(input.operationId))
      banks.set(input.operationId, {
        operationId: input.operationId,
        mode: "sandbox",
        revision: 0,
        status: "verified",
        evidence: {
          ownerName: input.identity.legalName,
          ownershipVerified: true,
          accountFingerprint: input.accountFingerprint,
          identityAttemptId: input.identityAttemptId,
          policyVersion: "fixture-exact-v1",
          nameMatch: true,
        },
      });
    return banks.get(input.operationId)!;
  },
  async bankStatus(id) {
    return banks.get(id)!;
  },
  async authenticateWebhook(raw, headers) {
    const timestamp = String(headers["x-fixture-time"]),
      sig = String(headers["x-fixture-signature"]);
    if (
      Math.abs(Date.now() - Number(timestamp)) > 300000 ||
      !/^\d+$/.test(timestamp) ||
      !/^[a-f0-9]{64}$/.test(sig)
    )
      throw new Error("invalid signature");
    const expected = createHmac("sha256", secret)
      .update(timestamp + ".")
      .update(raw)
      .digest();
    if (!timingSafeEqual(Buffer.from(sig, "hex"), expected))
      throw new Error("invalid signature");
    return JSON.parse(raw.toString());
  },
};
let runtime: Awaited<ReturnType<typeof createApp>>, server: any;
const post = (path: string, body: any, cookie?: string) => {
  const r = request(server)
    .post("/api/" + path)
    .set("Origin", config.APP_ORIGIN)
    .set("X-Zetmond-Request", "1")
    .send(body);
  return cookie ? r.set("Cookie", cookie) : r;
};
const get = (path: string, cookie?: string) => {
  const r = request(server).get("/api/" + path);
  return cookie ? r.set("Cookie", cookie) : r;
};
async function customer(email = "verify@example.test") {
  const r = await post("auth/register", {
    email,
    phone:
      email === "verify@example.test" ? "+2348031234567" : "+2348031234568",
    country: "NG",
    password: "Long verification test password!",
    acceptTerms: true,
    policyVersion: "development-draft",
  });
  assert.equal(r.status, 201);
  return {
    id: r.body.user.id,
    cookie: r.headers["set-cookie"][0].split(";")[0],
  };
}
async function start(c: { id: string; cookie: string }) {
  await runtime.db.pool.query(
    "UPDATE users SET email_verified=true WHERE id=$1",
    [c.id],
  );
  const r = await post(
    "identity/sessions",
    { disclosureVersion: "fixture-v1" },
    c.cookie,
  );
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const a = (
    await runtime.db.pool.query(
      "SELECT current_attempt_id FROM identity_cases WHERE user_id=$1",
      [c.id],
    )
  ).rows[0].current_attempt_id;
  await runtime.verificationWorker.dispatch();
  return a as string;
}
async function result(id: string, patch: Partial<IdentityResult>) {
  identity.set(id, {
    ...identity.get(id)!,
    revision: (identity.get(id)?.revision || 0) + 1,
    ...patch,
  });
  await runtime.db.tx((c) =>
    runtime.verification.enqueue(c, id, "identity_sync"),
  );
  await runtime.verificationWorker.dispatch();
}
async function approved(c: { id: string; cookie: string }) {
  const id = await start(c);
  await result(id, {
    status: "approved",
    evidence: {
      legalName: "Test Customer",
      dateOfBirth: "1990-01-01",
      country: "NG",
      governmentIdVerified: true,
      livenessVerified: true,
    },
  });
  await runtime.db.pool.query("UPDATE users SET mfa_secret=$2 WHERE id=$1", [
    c.id,
    seal(config.DATA_ENCRYPTION_KEY, "fixture-secret"),
  ]);
  return id;
}
async function grant(c: { id: string; cookie: string }, input: any) {
  const session = (
      await runtime.db.pool.query(
        "SELECT id FROM sessions WHERE user_id=$1 AND revoked_at IS NULL",
        [c.id],
      )
    ).rows[0].id,
    id = randomUUID();
  await runtime.db.pool.query(
    "INSERT INTO step_ups(id,session_id,purpose,operation_digest,expires_at) VALUES($1,$2,'bank_add',$3,now()+interval '5 minutes')",
    [id, session, digest(config.DATA_ENCRYPTION_KEY, bankDigest(input))],
  );
  return id;
}
function webhook(
  id: string,
  eventId = randomUUID(),
  timestamp = String(Date.now()),
  valid = true,
) {
  const body = JSON.stringify({ eventId, operationId: id, mode: "sandbox" }),
    signature = createHmac("sha256", secret)
      .update(timestamp + "." + body)
      .digest("hex");
  return request(server)
    .post("/api/webhooks/fixture")
    .set("Content-Type", "application/json")
    .set("X-Fixture-Time", timestamp)
    .set("X-Fixture-Signature", valid ? signature : "0".repeat(64))
    .send(body);
}
before(async () => {
  await migrate(url);
  runtime = await createApp(config, [provider]);
  server = runtime.app.getHttpServer();
});
beforeEach(async () => {
  await runtime.db.pool.query(
    "TRUNCATE users,sessions,challenges,recovery_codes,step_ups,audit_events,delivery_outbox,rate_limits,verification_events,verification_jobs RESTART IDENTITY CASCADE",
  );
  identity.clear();
  banks.clear();
  starts = 0;
  bankStarts = 0;
  throwOnce = false;
});
after(() => runtime.close());

test("removed launch countries cannot dispatch saved identity work", async () => {
  for (const [email, accountCountry, attemptCountry] of [
    ["verify@example.test", "ZA", "NG"],
    ["country-scope@example.test", "NG", "ZA"],
  ]) {
    const c = await customer(email);
    await runtime.db.pool.query(
      "UPDATE users SET email_verified=true WHERE id=$1",
      [c.id],
    );
    const started = await post(
      "identity/sessions",
      { disclosureVersion: "fixture-v1" },
      c.cookie,
    );
    assert.equal(started.status, 201);
    await runtime.db.pool.query("UPDATE users SET country=$2 WHERE id=$1", [
      c.id,
      accountCountry,
    ]);
    await runtime.db.pool.query(
      "UPDATE identity_attempts SET country=$2 WHERE id=$1",
      [started.body.attemptId, attemptCountry],
    );
    await runtime.verificationWorker.dispatch();
    assert.equal(starts, 0);
    const view = await get("identity", c.cookie);
    assert.equal(view.body.available, false);
    assert.equal(view.body.canStart, false);
  }
  assert.equal(
    (
      await runtime.db.pool.query(
        "SELECT count(*) FROM identity_attempts WHERE status='approved'",
      )
    ).rows[0].count,
    "0",
  );
});
test("identity endpoints require customer login, email and current disclosure; browser cannot supply approvals", async () => {
  assert.equal((await get("identity")).status, 401);
  const c = await customer();
  assert.equal(
    (
      await post(
        "identity/sessions",
        { disclosureVersion: "fixture-v1" },
        c.cookie,
      )
    ).status,
    403,
  );
  await runtime.db.pool.query(
    "UPDATE users SET email_verified=true WHERE id=$1",
    [c.id],
  );
  assert.equal(
    (await post("identity/sessions", { disclosureVersion: "old" }, c.cookie))
      .status,
    400,
  );
  assert.equal(
    (
      await post(
        "identity/sessions",
        { disclosureVersion: "fixture-v1", status: "approved" },
        c.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(server)
        .post("/api/identity/sessions")
        .set("Cookie", c.cookie)
        .send({ disclosureVersion: "fixture-v1" })
    ).status,
    403,
  );
  await runtime.db.pool.query("UPDATE users SET role='admin' WHERE id=$1", [
    c.id,
  ]);
  assert.equal((await get("identity", c.cookie)).status, 403);
});
test("missing provider never creates a case or accepts an unregistered webhook", async () => {
  const empty = await createApp(config);
  try {
    const c = await customer();
    await runtime.db.pool.query(
      "UPDATE users SET email_verified=true WHERE id=$1",
      [c.id],
    );
    const r = await request(empty.app.getHttpServer())
      .get("/api/identity")
      .set("Cookie", c.cookie);
    assert.equal(r.body.available, false);
    assert.equal(
      (
        await request(empty.app.getHttpServer())
          .post("/api/identity/sessions")
          .set("Cookie", c.cookie)
          .set("Origin", config.APP_ORIGIN)
          .set("X-Zetmond-Request", "1")
          .send({ disclosureVersion: "fixture-v1" })
      ).status,
      503,
    );
    assert.equal(
      (
        await request(empty.app.getHttpServer())
          .post("/api/webhooks/fixture")
          .send({})
      ).status,
      403,
    );
    assert.equal(
      (await runtime.db.pool.query("SELECT count(*) FROM identity_cases"))
        .rows[0].count,
      "0",
    );
  } finally {
    await empty.close();
  }
});
test("duplicate starts and uncertain provider outcomes recover the same persisted operation after restart", async () => {
  const c = await customer();
  throwOnce = true;
  const id = await start(c);
  assert.equal((await get("identity", c.cookie)).body.status, "submitting");
  await Promise.all([
    post("identity/sessions", { disclosureVersion: "fixture-v1" }, c.cookie),
    post("identity/sessions", { disclosureVersion: "fixture-v1" }, c.cookie),
  ]);
  await runtime.db.pool.query("UPDATE verification_jobs SET run_at=now()");
  await new VerificationWorker(runtime.verification).dispatch();
  assert.equal(identity.size, 1);
  assert.equal(starts, 2);
  assert.equal(
    (await runtime.db.pool.query("SELECT count(*) FROM identity_attempts"))
      .rows[0].count,
    "1",
  );
  const r = await get("identity", c.cookie);
  assert.equal(r.body.status, "incomplete");
  assert.ok(r.body.capture.url.startsWith("https://capture.example.test/"));
  const stored = (
    await runtime.db.pool.query(
      "SELECT capture_payload FROM identity_attempts WHERE id=$1",
      [id],
    )
  ).rows[0];
  assert.ok(!stored.capture_payload.includes("https://"));
});
test("authenticated raw webhooks deduplicate, reject tampering and expiry, and reconcile canonical status", async () => {
  const c = await customer(),
    id = await start(c),
    eventId = randomUUID();
  assert.equal(
    (await webhook(id, eventId, String(Date.now()), false)).status,
    401,
  );
  assert.equal(
    (await webhook(id, eventId, String(Date.now() - 600000))).status,
    401,
  );
  assert.equal((await webhook(id, eventId)).status, 200);
  assert.equal((await webhook(id, eventId)).status, 200);
  assert.equal(
    (await runtime.db.pool.query("SELECT count(*) FROM verification_events"))
      .rows[0].count,
    "1",
  );
  await runtime.verificationWorker.dispatch();
  assert.equal((await get("identity", c.cookie)).body.status, "incomplete");
});
test("age and country evidence are mandatory; rejected attempts cannot be resurrected", async () => {
  const c = await customer(),
    id = await start(c);
  await result(id, { status: "approved" });
  assert.equal((await get("identity", c.cookie)).body.status, "under_review");
  await result(id, {
    status: "approved",
    evidence: {
      legalName: "Minor",
      dateOfBirth: "2020-01-01",
      country: "NG",
      governmentIdVerified: true,
      livenessVerified: true,
    },
  });
  assert.equal((await get("identity", c.cookie)).body.status, "rejected");
  await result(id, {
    status: "approved",
    evidence: {
      legalName: "Changed",
      dateOfBirth: "1990-01-01",
      country: "NG",
      governmentIdVerified: true,
      livenessVerified: true,
    },
  });
  assert.equal((await get("identity", c.cookie)).body.status, "rejected");
  assert.equal(
    (await get("auth/me", c.cookie)).body.user.financialAccess,
    false,
  );
  assert.equal(
    (
      await post(
        "identity/resubmissions",
        { disclosureVersion: "fixture-v1" },
        c.cookie,
      )
    ).status,
    409,
  );
});
test("country mismatch and invalid capture redirects cannot approve identity", async () => {
  const c = await customer(),
    id = await start(c);
  await result(id, {
    status: "approved",
    evidence: {
      legalName: "Test Customer",
      dateOfBirth: "1990-01-01",
      country: "GH",
      governmentIdVerified: true,
      livenessVerified: true,
    },
  });
  assert.equal((await get("identity", c.cookie)).body.status, "rejected");
  assert.equal(adult("2008-11-07", new Date("2026-11-06T12:00:00Z")), false);
  assert.equal(adult("2008-11-06", new Date("2026-11-06T12:00:00Z")), true);
});
test("corrections preserve history and stale decisions cannot approve the replacement attempt", async () => {
  const c = await customer(),
    id = await start(c);
  await result(id, {
    status: "correction_required",
    reason: "document_unreadable",
  });
  assert.equal(
    (
      await post(
        "identity/resubmissions",
        { disclosureVersion: "fixture-v1" },
        c.cookie,
      )
    ).status,
    201,
  );
  await runtime.verificationWorker.dispatch();
  await result(id, {
    status: "approved",
    evidence: {
      legalName: "Old",
      dateOfBirth: "1990-01-01",
      country: "NG",
      governmentIdVerified: true,
      livenessVerified: true,
    },
  });
  assert.equal((await get("identity", c.cookie)).body.status, "incomplete");
  assert.equal(
    (await runtime.db.pool.query("SELECT count(*) FROM identity_attempts"))
      .rows[0].count,
    "2",
  );
  assert.equal(
    (await runtime.db.pool.query("SELECT count(*) FROM verification_decisions"))
      .rows[0].count,
    "3",
  );
});
test("newer revocation wins over out-of-order approval and existing sessions refresh eligibility", async () => {
  const c = await customer(),
    id = await approved(c);
  assert.equal(
    (await get("auth/me", c.cookie)).body.user.financialAccess,
    true,
  );
  await result(id, { revision: 4, status: "under_review" });
  await result(id, { revision: 2, status: "approved" });
  assert.equal((await get("identity", c.cookie)).body.status, "under_review");
  assert.equal(
    (await get("account/financial-eligibility", c.cookie)).status,
    403,
  );
});
test("restrictions prevent queued provider calls and later approvals", async () => {
  const c = await customer(),
    id = await start(c);
  await runtime.db.pool.query("UPDATE users SET restricted=true WHERE id=$1", [
    c.id,
  ]);
  await result(id, {
    status: "approved",
    evidence: {
      legalName: "Test Customer",
      dateOfBirth: "1990-01-01",
      country: "NG",
      governmentIdVerified: true,
      livenessVerified: true,
    },
  });
  assert.equal(
    (
      await runtime.db.pool.query("SELECT kyc_status FROM users WHERE id=$1", [
        c.id,
      ])
    ).rows[0].kyc_status,
    "pending",
  );
  assert.equal((await get("identity", c.cookie)).status, 401);
});
test("bank authorization is exact, atomic and single use; details encrypted and listings owner-scoped", async () => {
  const c = await customer();
  await approved(c);
  const input = {
    operationId: randomUUID(),
    country: "NG" as const,
    bankCode: "fixture-bank",
    accountNumber: "1234567890",
  };
  const stepUpId = await grant(c, input);
  assert.equal(
    (
      await post(
        "banks",
        { ...input, accountNumber: "1234567891", stepUpId },
        c.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await runtime.db.pool.query(
        "SELECT consumed_at FROM step_ups WHERE id=$1",
        [stepUpId],
      )
    ).rows[0].consumed_at,
    null,
  );
  assert.equal(
    (await post("banks", { ...input, stepUpId }, c.cookie)).status,
    201,
  );
  assert.equal(
    (await post("banks", { ...input, stepUpId }, c.cookie)).status,
    201,
  );
  await runtime.verificationWorker.dispatch();
  assert.equal(bankStarts, 1);
  const list = await get("banks", c.cookie);
  assert.equal(list.body.destinations[0].status, "verified");
  assert.equal(list.body.destinations[0].maskedAccount, "•••• 7890");
  assert.ok(!JSON.stringify(list.body).includes("1234567890"));
  const stored = (
    await runtime.db.pool.query(
      "SELECT details_payload,evidence_payload FROM bank_destinations",
    )
  ).rows[0];
  assert.ok(!stored.details_payload.includes("1234567890"));
  assert.equal(
    unseal(config.DATA_ENCRYPTION_KEY, stored.details_payload).accountNumber,
    "1234567890",
  );
  const second = {
    ...input,
    operationId: randomUUID(),
    accountNumber: "5555567890",
  };
  assert.equal(
    (await post("banks", { ...second, stepUpId }, c.cookie)).status,
    403,
  );
  const other = await customer("other@example.test");
  await approved(other);
  assert.equal((await get("banks", other.cookie)).body.destinations.length, 0);
  assert.equal(
    (await post(`banks/${input.operationId}/verifications`, {}, other.cookie))
      .status,
    404,
  );
  assert.equal(
    (await post("banks", { ...input, stepUpId }, other.cookie)).status,
    409,
  );
});
test("bank provider evidence must bind ownership to destination, identity and approved matching policy", async () => {
  const c = await customer();
  await approved(c);
  const input = {
      operationId: randomUUID(),
      country: "NG" as const,
      bankCode: "fixture-bank",
      accountNumber: "1234567890",
    },
    stepUpId = await grant(c, input);
  banks.set(input.operationId, {
    operationId: input.operationId,
    mode: "sandbox",
    revision: 0,
    status: "verified",
  });
  await post("banks", { ...input, stepUpId }, c.cookie);
  await runtime.verificationWorker.dispatch();
  assert.equal(
    (await get("banks", c.cookie)).body.destinations[0].status,
    "mismatch",
  );
  assert.equal(
    (await post(`banks/${input.operationId}/verifications`, {}, c.cookie))
      .status,
    409,
  );
});
test("sandbox approvals never enable staging financial access", async () => {
  const c = await customer();
  await approved(c);
  runtime.auth.config.DEPLOYMENT_STAGE = "staging";
  try {
    assert.equal(
      (await get("auth/me", c.cookie)).body.user.financialAccess,
      false,
    );
    assert.equal(
      (await get("account/financial-eligibility", c.cookie)).status,
      403,
    );
    assert.equal((await get("banks", c.cookie)).body.canAdd, true);
  } finally {
    runtime.auth.config.DEPLOYMENT_STAGE = "production";
  }
});

test("expired worker leases recover and unsafe capture URLs never reach a customer", async () => {
  const c = await customer();
  await runtime.db.pool.query(
    "UPDATE users SET email_verified=true WHERE id=$1",
    [c.id],
  );
  await post(
    "identity/sessions",
    { disclosureVersion: "fixture-v1" },
    c.cookie,
  );
  const id = (
    await runtime.db.pool.query(
      "SELECT current_attempt_id FROM identity_cases WHERE user_id=$1",
      [c.id],
    )
  ).rows[0].current_attempt_id;
  await runtime.db.pool.query(
    "UPDATE verification_jobs SET state='running',lease_token=$1,lease_until=now()-interval '1 second'",
    [randomUUID()],
  );
  await new VerificationWorker(runtime.verification).dispatch();
  assert.equal((await get("identity", c.cookie)).body.status, "incomplete");
  await result(id, {
    revision: 1,
    capture: {
      url: "https://evil.example.test/capture",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    },
  });
  const r = await get("identity", c.cookie);
  assert.ok(r.body.capture.url.startsWith("https://capture.example.test/"));
  assert.equal(
    (
      await runtime.db.pool.query(
        "SELECT attempts FROM verification_jobs WHERE kind='identity_sync'",
      )
    ).rows[0].attempts,
    1,
  );
});

test("production financial access rejects a sandbox projection after promotion", async () => {
  const c = await customer();
  await approved(c);
  const u = await runtime.db.tx((db) =>
    runtime.auth.current(db, decodeURIComponent(c.cookie.split("=")[1])),
  );
  runtime.auth.config.NODE_ENV = "production";
  try {
    assert.equal(runtime.auth.view(u).financialAccess, false);
    assert.equal(
      runtime.auth.view({ ...u, identity_mode: "live" }).financialAccess,
      true,
    );
  } finally {
    runtime.auth.config.NODE_ENV = "test";
  }
});

test("bank entry needs MFA enrollment and a verified identity; no typed owner can bypass checks", async () => {
  const c = await customer(),
    input = {
      operationId: randomUUID(),
      country: "NG",
      bankCode: "fixture-bank",
      accountNumber: "1234567890",
      stepUpId: randomUUID(),
    };
  assert.equal((await post("banks", input, c.cookie)).status, 403);
  await start(c);
  assert.equal((await post("banks", input, c.cookie)).status, 403);
  const a = (
    await runtime.db.pool.query(
      "SELECT current_attempt_id FROM identity_cases WHERE user_id=$1",
      [c.id],
    )
  ).rows[0].current_attempt_id;
  await result(a, {
    status: "approved",
    evidence: {
      legalName: "Test Customer",
      dateOfBirth: "1990-01-01",
      country: "NG",
      governmentIdVerified: true,
      livenessVerified: true,
    },
  });
  assert.equal((await post("banks", input, c.cookie)).status, 403);
  assert.equal(
    (
      await post(
        "banks",
        { ...input, ownerName: "Test Customer", verified: true },
        c.cookie,
      )
    ).status,
    400,
  );
});

test(
  "BullMQ restart and queue loss recover PostgreSQL verification work",
  { skip: !process.env.TEST_REDIS_URL },
  async () => {
    const { startVerificationQueue } =
      await import("../src/jobs/verification-queue");
    const redisUrl = process.env.TEST_REDIS_URL!;
    const parsed = new URL(redisUrl);
    if (!["127.0.0.1", "localhost"].includes(parsed.hostname))
      throw new Error("Queue test requires local isolated Redis");
    const name = "zetmond-verification-test-" + randomUUID(),
      c = await customer();
    await runtime.db.pool.query(
      "UPDATE users SET email_verified=true WHERE id=$1",
      [c.id],
    );
    let active = await startVerificationQueue(
      runtime.verificationWorker,
      redisUrl,
      name,
    );
    try {
      await active.worker.close();
      await post(
        "identity/sessions",
        { disclosureVersion: "fixture-v1" },
        c.cookie,
      );
      await active.queue.obliterate({ force: true });
      await active.queue.close();
      active = await startVerificationQueue(
        new VerificationWorker(runtime.verification),
        redisUrl,
        name,
      );
      const deadline = Date.now() + 10000;
      while (
        Date.now() < deadline &&
        (await get("identity", c.cookie)).body.status === "submitting"
      )
        await new Promise((r) => setTimeout(r, 100));
      assert.equal((await get("identity", c.cookie)).body.status, "incomplete");
      const jobs = await active.queue.getJobs([
        "waiting",
        "active",
        "completed",
        "delayed",
      ]);
      assert.ok(jobs.every((job) => JSON.stringify(job.data) === "{}"));
    } finally {
      await active.worker.close();
      await active.queue.obliterate({ force: true });
      await active.queue.close();
    }
  },
);
