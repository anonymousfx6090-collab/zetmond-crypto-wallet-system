import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, ConfigurationError } from "../src/config";
import {
  SmileIdClient,
  SmileIdError,
  configuredSmileIdClient,
  smileIdSignature,
} from "../src/providers/smile-id.client";
const timestamp = "2026-11-07T12:00:00.000Z";
const signature = "fd+olib0Vb5MZStKxXfanFVN35eHVLIrNBNX86NLx3w=";
const credentials = {
  partnerId: "001",
  apiKey: "fixture-api-key",
  mode: "sandbox" as const,
};
const input = {
  userId: "fixture-user",
  jobId: "fixture-job",
  product: "fixture-product",
  callbackUrl: "https://app.example.test/callback",
};
const clock = () => new Date(timestamp);
const fixtureConfig = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://fixture@localhost/fixture_test",
  DATA_ENCRYPTION_KEY: "a".repeat(64),
};
function client(transport: typeof fetch) {
  return new SmileIdClient(credentials, transport, clock);
}
function response(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

test("Smile ID signature matches an offline vector from official SDK 3.2.1", () => {
  assert.equal(
    smileIdSignature(credentials.partnerId, credentials.apiKey, timestamp),
    signature,
  );
});
test("Smile ID token uses the fixed sandbox origin, stable identifiers, deadline and secret-safe response", async () => {
  let calls = 0;
  const c = client(async (url, options) => {
    calls++;
    assert.equal(url, "https://testapi.smileidentity.com/v1/token");
    assert.equal(options?.method, "POST");
    assert.equal(options?.redirect, "error");
    assert.equal(options?.credentials, "omit");
    assert.ok(options?.signal);
    assert.deepEqual(JSON.parse(String(options?.body)), {
      user_id: input.userId,
      job_id: input.jobId,
      product: input.product,
      callback_url: input.callbackUrl,
      partner_id: "001",
      timestamp,
      signature,
    });
    assert.ok(!String(options?.body).includes(credentials.apiKey));
    return response({
      token: "fixture-capture-token",
      api_key: credentials.apiKey,
    });
  });
  assert.deepEqual(await c.getWebToken(input), {
    token: "fixture-capture-token",
  });
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(c).includes(credentials.apiKey));
});
test("Smile ID live client uses only the fixed live origin", async () => {
  const c = new SmileIdClient(
    { ...credentials, mode: "live" },
    async (url) => {
      assert.equal(url, "https://api.smileidentity.com/v1/token");
      return response({ token: "fixture-token" });
    },
    clock,
  );
  await c.getWebToken(input);
});
test("Smile ID rejects unsafe callback URLs and missing operation details before any request", async () => {
  let calls = 0;
  const c = client(async () => {
    calls++;
    return response({});
  });
  for (const callbackUrl of [
    "http://app.example.test/callback",
    "https://user:secret@app.example.test/callback",
    "https://app.example.test/#fragment",
    "not-a-url",
  ])
    await assert.rejects(
      c.getWebToken({ ...input, callbackUrl }),
      SmileIdError,
    );
  for (const key of ["userId", "jobId", "product"] as const)
    await assert.rejects(c.getWebToken({ ...input, [key]: "" }), SmileIdError);
  assert.equal(calls, 0);
});
test("Smile ID status verifies the envelope signature and avoids fetching evidence images", async () => {
  const c = client(async (url, options) => {
    assert.equal(url, "https://testapi.smileidentity.com/v1/job_status");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.history, false);
    assert.equal(body.image_links, false);
    assert.equal(body.job_id, input.jobId);
    assert.equal(body.user_id, input.userId);
    return response({ timestamp, signature, job_complete: false });
  });
  assert.equal(
    (await c.getJobStatus(input.userId, input.jobId)).job_complete,
    false,
  );
});
test("Smile ID rejects invalid, non-canonical, expired and future timestamp signatures", async () => {
  const c = client(async () => response({}));
  assert.equal(c.verifyTimestampSignature(timestamp, signature), true);
  assert.equal(
    c.verifyTimestampSignature(Date.parse(timestamp), signature),
    true,
  );
  for (const value of [
    null,
    "",
    NaN,
    "invalid-date",
    {},
    new Date(Date.parse(timestamp) - 300001).toISOString(),
    new Date(Date.parse(timestamp) + 300001).toISOString(),
  ])
    assert.equal(c.verifyTimestampSignature(value, signature), false);
  for (const offset of [-300001, 300001]) {
    const dated = new Date(Date.parse(timestamp) + offset).toISOString();
    const validButStale = smileIdSignature(
      credentials.partnerId,
      credentials.apiKey,
      dated,
    );
    assert.equal(c.verifyTimestampSignature(dated, validButStale), false);
  }
  for (const value of [
    null,
    "",
    {},
    "0".repeat(44),
    signature.replace("=", "!"),
    signature + "\n",
  ])
    assert.equal(c.verifyTimestampSignature(timestamp, value), false);
  const altered = new SmileIdClient(
    { ...credentials, partnerId: "another-partner" },
    async () => response({}),
    clock,
  );
  assert.equal(altered.verifyTimestampSignature(timestamp, signature), false);
  await assert.rejects(
    client(async () =>
      response({ timestamp, signature: "invalid" }),
    ).getJobStatus(input.userId, input.jobId),
    SmileIdError,
  );
});
test("Smile ID does not retry uncertain failures or expose upstream secret values", async () => {
  let calls = 0;
  for (const value of [
    () => {
      throw new Error(credentials.apiKey);
    },
    () => new Response(credentials.apiKey, { status: 503 }),
    () => new Response(credentials.apiKey, { status: 200 }),
    () => response([]),
    () => response({ token: 42 }),
  ]) {
    const c = client(async () => {
      calls++;
      return value();
    });
    await assert.rejects(
      c.getWebToken(input),
      (e: unknown) =>
        e instanceof SmileIdError && !e.message.includes(credentials.apiKey),
    );
  }
  assert.equal(calls, 5);
});
test("Smile ID bounds response sizes, including streamed replies without a content length", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(256 * 1024 + 1));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    client(async () => new Response(body)).getWebToken(input),
    SmileIdError,
  );
  assert.equal(cancelled, true);
  await assert.rejects(
    client(
      async () =>
        new Response("{}", {
          headers: { "content-length": String(256 * 1024 + 1) },
        }),
    ).getWebToken(input),
    SmileIdError,
  );
});
test("Smile ID credentials are optional, explicitly parsed, and checked together only when used", () => {
  const empty = loadConfig(fixtureConfig);
  assert.equal(empty.SMILE_ID_MODE, "sandbox");
  assert.equal(configuredSmileIdClient(empty), undefined);
  const partial = loadConfig({ ...fixtureConfig, SMILE_ID_PARTNER_ID: "001" });
  assert.throws(() => configuredSmileIdClient(partial), ConfigurationError);
  const config = loadConfig({
    ...fixtureConfig,
    SMILE_ID_PARTNER_ID: "001",
    SMILE_ID_API_KEY: credentials.apiKey,
  });
  assert.equal(configuredSmileIdClient(config)?.mode, "sandbox");
  assert.throws(
    () => loadConfig({ ...fixtureConfig, SMILE_ID_MODE: "private-value" }),
    (e: unknown) =>
      e instanceof ConfigurationError &&
      e.message.includes("SMILE_ID_MODE") &&
      !e.message.includes("private-value"),
  );
});
test("Smile ID client construction separates hosted staging and production credentials", () => {
  const hosted = {
    ...fixtureConfig,
    NODE_ENV: "production",
    DELIVERY_MODE: "provider",
    APP_ORIGIN: "https://app.example.test",
    SMTP_HOST: "smtp.example.test",
    MAIL_FROM: "fixture@example.test",
    SECURITY_POLICY_APPROVED: "true",
    TERMS_VERSION: "fixture-v1",
    TERMS_URL: "https://app.example.test/terms",
    PRIVACY_URL: "https://app.example.test/privacy",
    SMILE_ID_PARTNER_ID: "001",
    SMILE_ID_API_KEY: credentials.apiKey,
  };
  assert.equal(
    configuredSmileIdClient(
      loadConfig({
        ...hosted,
        DEPLOYMENT_STAGE: "staging",
        SMILE_ID_MODE: "sandbox",
      }),
    )?.mode,
    "sandbox",
  );
  assert.equal(
    configuredSmileIdClient(
      loadConfig({
        ...hosted,
        DEPLOYMENT_STAGE: "production",
        SMILE_ID_MODE: "live",
      }),
    )?.mode,
    "live",
  );
  for (const [stage, mode] of [
    ["staging", "live"],
    ["production", "sandbox"],
  ])
    assert.throws(
      () =>
        configuredSmileIdClient(
          loadConfig({
            ...hosted,
            DEPLOYMENT_STAGE: stage,
            SMILE_ID_MODE: mode,
          }),
        ),
      ConfigurationError,
    );
});
