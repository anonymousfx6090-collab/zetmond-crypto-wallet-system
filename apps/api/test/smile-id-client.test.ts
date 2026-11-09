import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, ConfigurationError } from "../src/config";
import {
  SmileIdClient,
  SmileIdError,
  configuredSmileIdClient,
} from "../src/providers/smile-id.client";
import { checkSmileIdCredentials } from "../src/check-smile-id";
const credentials = {
  partnerId: "123",
  apiKey: "fixture-api-key",
  mode: "sandbox" as const,
};
const fixtureConfig = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://fixture@localhost/fixture_test",
  DATA_ENCRYPTION_KEY: "a".repeat(64),
};
function jwt(label = "one") {
  return [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
    Buffer.from(JSON.stringify({ fixture: label })).toString("base64url"),
    Buffer.from("fixture-signature").toString("base64url"),
  ].join(".");
}
function response(token = jwt()) {
  return new Response(JSON.stringify({ token }), { status: 200 });
}
function client(transport: typeof fetch, now: () => number = () => 0) {
  return new SmileIdClient(credentials, transport, now);
}

test("V3 token request matches the supplied bodyless curl contract and fixes origin per mode", async () => {
  const c = client(async (url, options) => {
    assert.equal(url, "https://testapi.smileidentity.com/v3/token");
    assert.equal(options?.method, "POST");
    assert.equal(options?.redirect, "error");
    assert.equal(options?.credentials, "omit");
    assert.ok(options?.signal);
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("smileid-partner-id"), "123");
    assert.equal(headers.get("smileid-api-key"), credentials.apiKey);
    assert.equal(headers.get("accept"), "application/json");
    assert.equal(headers.get("content-type"), null);
    assert.equal(options?.body, undefined);
    return response();
  });
  assert.equal(await c.getAccessToken(), jwt());
});
test("verification headers contain the access token and partner ID, without forwarding the API key", async () => {
  const c = client(async () => response());
  const headers = await c.getRequestHeaders();
  assert.deepEqual(headers, {
    "SmileID-Partner-ID": "123",
    "SmileID-Token": jwt(),
  });
  assert.ok(!JSON.stringify(headers).includes(credentials.apiKey));
  // Callers cannot alter the cached headers through a previously returned object.
  headers["SmileID-Token"] = "changed";
  assert.equal((await c.getRequestHeaders())["SmileID-Token"], jwt());
  assert.ok(!JSON.stringify(c).includes(jwt()));
  assert.ok(!JSON.stringify(c).includes(credentials.apiKey));
});
test("cached tokens are renewed a minute before the documented 15-minute expiry", async () => {
  let now = 0,
    calls = 0;
  const c = client(
    async () => response(jwt(String(++calls))),
    () => now,
  );
  assert.equal(await c.getAccessToken(), jwt("1"));
  now = 14 * 60 * 1000 - 1;
  assert.equal(await c.getAccessToken(), jwt("1"));
  assert.equal(calls, 1);
  now = 14 * 60 * 1000;
  assert.equal(await c.getAccessToken(), jwt("2"));
  assert.equal(calls, 2);
  now = 15 * 60 * 1000;
  assert.equal(await c.getAccessToken(), jwt("2"));
  assert.equal(calls, 2);
});
test("simultaneous callers share one token request", async () => {
  let calls = 0;
  const c = client(async () => {
    calls++;
    return response();
  });
  const results = await Promise.all(
    Array.from({ length: 20 }, () => c.getRequestHeaders()),
  );
  assert.equal(calls, 1);
  assert.ok(results.every((v) => v["SmileID-Token"] === jwt()));
});
test("sandbox, production and separate credentials never share a token cache", async () => {
  let sandboxCalls = 0,
    liveCalls = 0,
    otherCalls = 0;
  const sandbox = client(async () => {
    sandboxCalls++;
    return response(jwt("sandbox"));
  });
  const live = new SmileIdClient(
    { ...credentials, mode: "live" },
    async (url, options) => {
      liveCalls++;
      assert.equal(url, "https://api.smileidentity.com/v3/token");
      assert.equal(
        new Headers(options?.headers).get("smileid-api-key"),
        credentials.apiKey,
      );
      return response(jwt("live"));
    },
  );
  const other = new SmileIdClient(
    { ...credentials, apiKey: "other-fixture-key" },
    async (_, options) => {
      otherCalls++;
      assert.equal(
        new Headers(options?.headers).get("smileid-api-key"),
        "other-fixture-key",
      );
      return response(jwt("other"));
    },
  );
  assert.equal(await sandbox.getAccessToken(), jwt("sandbox"));
  assert.equal(await live.getAccessToken(), jwt("live"));
  assert.equal(await other.getAccessToken(), jwt("other"));
  await Promise.all([
    sandbox.getAccessToken(),
    live.getAccessToken(),
    other.getAccessToken(),
  ]);
  assert.deepEqual([sandboxCalls, liveCalls, otherCalls], [1, 1, 1]);
});
test("a rejected token can be invalidated without replaying any business request", async () => {
  let calls = 0;
  const c = client(async () => response(jwt(String(++calls))));
  const first = await c.getAccessToken();
  c.invalidateAccessToken(first);
  const second = await c.getAccessToken();
  assert.equal(second, jwt("2"));
  assert.equal(calls, 2);
  c.invalidateAccessToken(first);
  assert.equal(await c.getAccessToken(), second);
  assert.equal(calls, 2);
});
test("invalidation during a refresh fences the old response and preserves the newer token", async () => {
  let calls = 0,
    completeFirst!: (response: Response) => void;
  const c = client(async () => {
    calls++;
    if (calls === 1)
      return new Promise<Response>((resolve) => {
        completeFirst = resolve;
      });
    return response(jwt("new"));
  });
  const old = c.getAccessToken(),
    rejected = assert.rejects(old, SmileIdError);
  c.invalidateAccessToken();
  assert.equal(await c.getAccessToken(), jwt("new"));
  completeFirst(response(jwt("old")));
  await rejected;
  assert.equal(await c.getAccessToken(), jwt("new"));
  assert.equal(calls, 2);
});
test("a token received after its safe lifetime is not returned or cached", async () => {
  let now = 0,
    calls = 0;
  const c = client(
    async () => {
      calls++;
      if (calls === 1) now = 14 * 60 * 1000;
      return response(jwt(String(calls)));
    },
    () => now,
  );
  await assert.rejects(c.getAccessToken(), SmileIdError);
  assert.equal(await c.getAccessToken(), jwt("2"));
  assert.equal(calls, 2);
});
test("failed concurrent token requests are not retried automatically and can recover later", async () => {
  let calls = 0,
    failed = true;
  const c = client(async () => {
    calls++;
    if (failed) throw new Error(credentials.apiKey);
    return response();
  });
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => c.getAccessToken()),
  );
  assert.equal(calls, 1);
  assert.ok(
    results.every(
      (v) =>
        v.status === "rejected" &&
        v.reason instanceof SmileIdError &&
        !v.reason.message.includes(credentials.apiKey),
    ),
  );
  failed = false;
  assert.equal(await c.getAccessToken(), jwt());
  assert.equal(calls, 2);
});
test("an expired token is never served when refresh fails", async () => {
  let now = 0,
    calls = 0;
  const c = client(
    async () => {
      calls++;
      if (calls > 1) throw new Error("provider unavailable");
      return response();
    },
    () => now,
  );
  await c.getAccessToken();
  now = 15 * 60 * 1000;
  await assert.rejects(c.getRequestHeaders(), SmileIdError);
  assert.equal(calls, 2);
});
test("HTTP errors retain only a safe status and discard provider response details", async () => {
  for (const status of [201, 302, 401, 403, 415, 429, 500]) {
    let calls = 0;
    const c = client(async () => {
      calls++;
      return new Response(credentials.apiKey, { status });
    });
    await assert.rejects(
      c.getAccessToken(),
      (error: unknown) =>
        error instanceof SmileIdError &&
        error.message.includes(String(status)) &&
        !error.message.includes(credentials.apiKey),
    );
    assert.equal(calls, 1);
  }
});
test("malformed token responses never become authorization headers", async () => {
  for (const data of [
    null,
    [],
    {},
    { token: 42 },
    { token: "" },
    { token: "not-a-jwt" },
    { token: "a.b.c\r\ninjected:value" },
    { token: jwt() + "\n" },
    { token: " " + jwt() },
    { token: "a".repeat(16385) + ".b.c" },
  ]) {
    const c = client(async () => new Response(JSON.stringify(data)));
    await assert.rejects(c.getRequestHeaders(), SmileIdError);
  }
  await assert.rejects(
    client(async () => new Response(credentials.apiKey)).getAccessToken(),
    (error: unknown) =>
      error instanceof SmileIdError &&
      !error.message.includes(credentials.apiKey),
  );
  // A custom transport's exception must not bypass the secret-safe error boundary.
  await assert.rejects(
    client(async () => {
      throw new SmileIdError(credentials.apiKey);
    }).getAccessToken(),
    (error: unknown) =>
      error instanceof SmileIdError &&
      !error.message.includes(credentials.apiKey),
  );
});
test("token response size is bounded even without a content length", async () => {
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
    client(async () => new Response(body)).getAccessToken(),
    SmileIdError,
  );
  assert.equal(cancelled, true);
  await assert.rejects(
    client(
      async () =>
        new Response("{}", {
          headers: { "content-length": String(256 * 1024 + 1) },
        }),
    ).getAccessToken(),
    SmileIdError,
  );
});
test("Smile ID settings stay optional and partial credentials cannot construct a client", () => {
  const empty = loadConfig(fixtureConfig);
  assert.equal(empty.SMILE_ID_MODE, "sandbox");
  assert.equal(configuredSmileIdClient(empty), undefined);
  assert.throws(
    () =>
      configuredSmileIdClient(
        loadConfig({ ...fixtureConfig, SMILE_ID_PARTNER_ID: "123" }),
      ),
    ConfigurationError,
  );
  const config = loadConfig({
    ...fixtureConfig,
    SMILE_ID_PARTNER_ID: "123",
    SMILE_ID_API_KEY: credentials.apiKey,
  });
  assert.equal(configuredSmileIdClient(config)?.mode, "sandbox");
  assert.throws(
    () => loadConfig({ ...fixtureConfig, SMILE_ID_MODE: "private-value" }),
    (error: unknown) =>
      error instanceof ConfigurationError &&
      error.message.includes("SMILE_ID_MODE") &&
      !error.message.includes("private-value"),
  );
});
test("partner IDs must be numeric without leading zeros in configuration and direct clients", () => {
  for (const value of [
    "0",
    "00",
    "001",
    "-1",
    "1.2",
    "12x",
    "１２３",
    "1\n2",
  ]) {
    assert.throws(
      () => loadConfig({ ...fixtureConfig, SMILE_ID_PARTNER_ID: value }),
      (error: unknown) =>
        error instanceof ConfigurationError &&
        error.message.includes("SMILE_ID_PARTNER_ID") &&
        !error.message.includes(value),
    );
    assert.throws(
      () => new SmileIdClient({ ...credentials, partnerId: value }),
      ConfigurationError,
    );
  }
  const normalized = loadConfig({
    ...fixtureConfig,
    SMILE_ID_PARTNER_ID: " 123 ",
  });
  assert.equal(normalized.SMILE_ID_PARTNER_ID, "123");
});
test("hosted staging and production client modes remain separate", () => {
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
    SMILE_ID_PARTNER_ID: "123",
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

test("operator credential check returns only authentication status and mode", async () => {
  const config = loadConfig({
    ...fixtureConfig,
    SMILE_ID_PARTNER_ID: "123",
    SMILE_ID_API_KEY: credentials.apiKey,
  });
  const result = await checkSmileIdCredentials(config, async () => response());
  assert.deepEqual(result, { authenticated: true, mode: "sandbox" });
  assert.ok(!JSON.stringify(result).includes(credentials.apiKey));
  assert.ok(!JSON.stringify(result).includes(jwt()));
});

test("operator credential check fails safely for missing or rejected credentials", async () => {
  await assert.rejects(
    checkSmileIdCredentials(loadConfig(fixtureConfig)),
    ConfigurationError,
  );
  const config = loadConfig({
    ...fixtureConfig,
    SMILE_ID_PARTNER_ID: "123",
    SMILE_ID_API_KEY: credentials.apiKey,
  });
  await assert.rejects(
    checkSmileIdCredentials(
      config,
      async () => new Response(credentials.apiKey, { status: 401 }),
    ),
    (error: unknown) =>
      error instanceof SmileIdError &&
      error.message.includes("401") &&
      !error.message.includes(credentials.apiKey),
  );
});
