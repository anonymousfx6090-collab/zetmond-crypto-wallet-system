import { test } from "node:test";
import assert from "node:assert/strict";
import { SmileIdClient } from "../src/providers/smile-id.client";
import {
  SmileIdStatusError,
  SmileIdStatusLookup,
} from "../src/providers/smile-id.status";

const key = "fixture-api-key";
const token = "e30.eyJmaXh0dXJlIjp0cnVlfQ.c2ln";
const jobId = "job_01h2xcejqtf2nbrexx3vqjhp41";
const userId = "user_01h8x9y2z3a4b5c6d7e8f9g0h1";
const generatedAt = "2026-07-07T12:34:56.000Z";
const lookup = (): SmileIdStatusLookup => ({ jobId, userId });
const status = (patch: Record<string, unknown> = {}) => ({
  status: "processing",
  job_id: jobId,
  user_id: userId,
  message: "Job is still processing",
  created_at: generatedAt,
  ...patch,
});
const json = (data: unknown, httpStatus = 200) =>
  new Response(JSON.stringify(data), { status: httpStatus });
function client(transport: typeof fetch, mode: "sandbox" | "live" = "sandbox") {
  return new SmileIdClient({ partnerId: "123", apiKey: key, mode }, transport);
}
const isError =
  (code: SmileIdStatusError["code"], httpStatus?: number) => (error: unknown) =>
    error instanceof SmileIdStatusError &&
    error.code === code &&
    error.httpStatus === httpStatus &&
    !error.message.includes(key) &&
    !error.message.includes(token) &&
    !error.message.includes(userId) &&
    !error.message.includes("private-provider-detail");

test("status lookup uses the documented GET path and flat processing response, exposing tracking only", async () => {
  let tokenCalls = 0,
    statusCalls = 0;
  const c = client(async (url, options) => {
    if (String(url).endsWith("/token")) {
      tokenCalls++;
      return json({ token });
    }
    statusCalls++;
    assert.equal(url, `https://testapi.smileidentity.com/v3/status/${jobId}`);
    assert.equal(options?.method, "GET");
    assert.equal(options?.body, undefined);
    assert.equal(options?.redirect, "error");
    assert.equal(options?.credentials, "omit");
    assert.ok(options?.signal);
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("smileid-partner-id"), "123");
    assert.equal(headers.get("smileid-token"), token);
    assert.equal(headers.get("smileid-api-key"), null);
    assert.equal(headers.get("accept"), "application/json");
    assert.equal(headers.get("content-type"), null);
    return json(
      status({
        message: "private-provider-detail",
        image_links: { private: "https://private.example.test" },
        id_fields: { fixture_only: "private-provider-detail" },
      }),
      202,
    );
  });
  assert.deepEqual(await c.getVerificationStatus(lookup()), {
    phase: "processing",
    status: "processing",
    jobId,
    userId,
    responseGeneratedAt: generatedAt,
  });
  assert.equal(tokenCalls, 1);
  assert.equal(statusCalls, 1);
});
test("all four HTTP 200 dispositions remain terminal tracking, never an approval", async () => {
  for (const disposition of ["clear", "block", "attention", "error"]) {
    const c = client(async (url) =>
      String(url).endsWith("/token")
        ? json({ token })
        : json(status({ status: disposition }), 200),
    );
    assert.deepEqual(await c.getVerificationStatus(lookup()), {
      phase: "terminal",
      status: disposition,
      jobId,
      userId,
      responseGeneratedAt: generatedAt,
    });
  }
});
test("live status lookup stays on the live origin", async () => {
  const c = client(async (url) => {
    assert.ok(String(url).startsWith("https://api.smileidentity.com/v3/"));
    if (String(url).endsWith("/token")) return json({ token });
    assert.equal(url, `https://api.smileidentity.com/v3/status/${jobId}`);
    return json(status(), 202);
  }, "live");
  await c.getVerificationStatus(lookup());
});
test("malformed lookup references are rejected before authentication or any provider request", async () => {
  let calls = 0;
  const c = client(async () => {
    calls++;
    return json({ token });
  });
  for (const input of [
    null,
    {},
    { ...lookup(), jobId: "job_123" },
    { ...lookup(), jobId: jobId + "\n" },
    { ...lookup(), jobId: jobId + "/../another-job" },
    { ...lookup(), jobId: "https://another.example.test" },
    { ...lookup(), jobId: jobId + "?user_id=another-user" },
    { ...lookup(), userId: undefined },
    { ...lookup(), userId: "unknown" },
    { ...lookup(), userId: userId + "\n" },
    { ...lookup(), url: "https://another.example.test" },
  ])
    await assert.rejects(
      c.getVerificationStatus(input as any),
      isError("invalid_request"),
    );
  assert.equal(calls, 0);
});
test("status responses must bind the exact requested job and expected user and contain valid tracking fields", async () => {
  for (const body of [
    status({ status: "clear", job_id: "job_01h2xcejqtf2nbrexx3vqjhp42" }),
    status({ status: "clear", user_id: "another-user" }),
    status({ status: "clear", user_id: "unknown" }),
    status({ status: "clear", job_id: undefined }),
    status({ status: "clear", created_at: "invalid" }),
    status({ status: "approved" }),
    status({ status: "not_found" }),
    { Headers: { job_id: jobId }, Response: status({ status: "clear" }) },
    {},
  ]) {
    const c = client(async (url) =>
      String(url).endsWith("/token") ? json({ token }) : json(body, 200),
    );
    await assert.rejects(
      c.getVerificationStatus(lookup()),
      isError("invalid_response"),
    );
  }
});
test("HTTP status and body disposition must agree before a tracking state can be returned", async () => {
  for (const [httpStatus, disposition] of [
    [200, "processing"],
    [202, "clear"],
    [202, "block"],
    [202, "attention"],
    [202, "error"],
  ] as const) {
    const c = client(async (url) =>
      String(url).endsWith("/token")
        ? json({ token })
        : json(status({ status: disposition }), httpStatus),
    );
    await assert.rejects(
      c.getVerificationStatus(lookup()),
      isError("invalid_response"),
    );
  }
});
test("HTTP failures including ambiguous 404 never recreate a job or replay a request; 401 only invalidates the token", async () => {
  for (const httpStatus of [301, 302, 400, 401, 403, 404, 429, 500, 503]) {
    let tokenCalls = 0,
      statusCalls = 0;
    const c = client(async (url) => {
      if (String(url).endsWith("/token")) {
        tokenCalls++;
        return json({ token });
      }
      assert.ok(String(url).includes("/status/"));
      statusCalls++;
      return json(status({ status: "clear", message: key }), httpStatus);
    });
    await assert.rejects(
      c.getVerificationStatus(lookup()),
      isError(httpStatus === 404 ? "not_found" : "provider_error", httpStatus),
    );
    assert.equal(statusCalls, 1);
    assert.equal(tokenCalls, 1);
    await c.getAccessToken();
    assert.equal(tokenCalls, httpStatus === 401 ? 2 : 1);
    assert.equal(statusCalls, 1);
  }
});
test("authentication failure never dispatches a status lookup or leaks transport credentials", async () => {
  let statusCalls = 0;
  const c = client(async (url) => {
    if (String(url).endsWith("/token")) throw new Error(`${key} ${userId}`);
    statusCalls++;
    return json(status(), 202);
  });
  await assert.rejects(
    c.getVerificationStatus(lookup()),
    isError("unavailable"),
  );
  assert.equal(statusCalls, 0);
});
test("an unavailable status request is sanitized and is not automatically retried", async () => {
  let statusCalls = 0;
  const c = client(async (url) => {
    if (String(url).endsWith("/token")) return json({ token });
    statusCalls++;
    throw new Error(`${token} private-provider-detail`);
  });
  await assert.rejects(
    c.getVerificationStatus(lookup()),
    isError("unavailable"),
  );
  assert.equal(statusCalls, 1);
});
test("invalid JSON and non-object status responses remain errors with no raw details", async () => {
  for (const body of ["", key, "{", "null", "[]"]) {
    const c = client(async (url) =>
      String(url).endsWith("/token")
        ? json({ token })
        : new Response(body, { status: 200 }),
    );
    await assert.rejects(
      c.getVerificationStatus(lookup()),
      isError("invalid_response"),
    );
  }
});
test("status response size and stream failures are bounded and sanitized", async () => {
  for (const response of [
    new Response(key, {
      status: 200,
      headers: { "content-length": String(256 * 1024 + 1) },
    }),
    new Response(new Uint8Array(256 * 1024 + 1), { status: 200 }),
    new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error(key));
        },
      }),
      { status: 200 },
    ),
  ]) {
    const c = client(async (url) =>
      String(url).endsWith("/token") ? json({ token }) : response,
    );
    await assert.rejects(
      c.getVerificationStatus(lookup()),
      isError("invalid_response"),
    );
  }
});
test("explicit subsequent polls reuse authentication but fetch fresh job tracking", async () => {
  let tokenCalls = 0,
    statusCalls = 0;
  const c = client(async (url) => {
    if (String(url).endsWith("/token")) {
      tokenCalls++;
      return json({ token });
    }
    statusCalls++;
    return statusCalls === 1
      ? json(status(), 202)
      : json(
          status({ status: "clear", created_at: "2026-07-07T12:35:56.000Z" }),
          200,
        );
  });
  assert.equal((await c.getVerificationStatus(lookup())).phase, "processing");
  assert.deepEqual(await c.getVerificationStatus(lookup()), {
    phase: "terminal",
    status: "clear",
    jobId,
    userId,
    responseGeneratedAt: "2026-07-07T12:35:56.000Z",
  });
  assert.equal(tokenCalls, 1);
  assert.equal(statusCalls, 2);
});
