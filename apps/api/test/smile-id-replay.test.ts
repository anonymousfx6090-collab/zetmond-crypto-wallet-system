import { test } from "node:test";
import assert from "node:assert/strict";
import { SmileIdClient } from "../src/providers/smile-id.client";
import { SmileIdReplayError } from "../src/providers/smile-id.replay";

const key = "fixture-replay-api-key";
const token = "e30.eyJmaXh0dXJlIjp0cnVlfQ.c2ln";
const stored = {
  jobId: "job_01h2xcejqtf2nbrexx3vqjhp41",
  userId: "user_01h8x9y2z3a4b5c6d7e8f9g0h1",
};
const json = (data: unknown, httpStatus = 200) =>
  new Response(JSON.stringify(data), { status: httpStatus });
const tracking = (patch: Record<string, unknown> = {}) => ({
  status: "clear",
  job_id: stored.jobId,
  user_id: stored.userId,
  message: "Job completed",
  created_at: "2026-11-09T12:00:00.000Z",
  ...patch,
});
const accepted = (patch: Record<string, unknown> = {}) => ({
  status: "accepted",
  job_id: stored.jobId,
  user_id: stored.userId,
  message: "private-provider-detail",
  ...patch,
});
function client(transport: typeof fetch, mode: "sandbox" | "live" = "sandbox") {
  return new SmileIdClient({ partnerId: "123", apiKey: key, mode }, transport);
}
function isError(
  outcome: SmileIdReplayError["outcome"],
  code: SmileIdReplayError["code"],
  httpStatus?: number,
) {
  return (error: unknown) =>
    error instanceof SmileIdReplayError &&
    error.outcome === outcome &&
    error.code === code &&
    error.httpStatus === httpStatus &&
    !error.message.includes(key) &&
    !error.message.includes(token) &&
    !error.message.includes(stored.userId) &&
    !error.message.includes("private-provider-detail");
}

test("replay confirms terminal status then makes one bodyless POST using the stored callback", async () => {
  const calls: string[] = [];
  const c = client(async (url, options) => {
    if (String(url).endsWith("/token")) {
      calls.push("token");
      return json({ token });
    }
    if (String(url).includes("/status/")) {
      calls.push("status");
      assert.equal(options?.method, "GET");
      return json(tracking());
    }
    calls.push("replay");
    assert.equal(
      url,
      `https://testapi.smileidentity.com/v3/replay/${stored.jobId}`,
    );
    assert.equal(options?.method, "POST");
    assert.equal(options?.body, undefined);
    assert.equal(options?.redirect, "error");
    assert.equal(options?.credentials, "omit");
    assert.ok(options?.signal);
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("smileid-partner-id"), "123");
    assert.equal(headers.get("smileid-token"), token);
    assert.equal(headers.get("smileid-api-key"), null);
    assert.equal(headers.get("content-type"), null);
    assert.equal(headers.get("accept"), "application/json");
    return json(accepted({ image_links: { private: "fixture-only" } }), 202);
  });
  assert.deepEqual(await c.replayVerificationWebhook(stored), {
    status: "accepted",
    ...stored,
  });
  assert.deepEqual(calls, ["token", "status", "replay"]);
});
test("replay supports all four terminal states without creating a new verification", async () => {
  for (const disposition of ["clear", "block", "attention", "error"]) {
    let replayCalls = 0;
    const c = client(async (url) => {
      if (String(url).endsWith("/token")) return json({ token });
      if (String(url).includes("/status/"))
        return json(tracking({ status: disposition }));
      assert.ok(String(url).includes("/replay/"));
      replayCalls++;
      return json(accepted(), 202);
    });
    assert.equal(
      (await c.replayVerificationWebhook(stored)).status,
      "accepted",
    );
    assert.equal(replayCalls, 1);
  }
});
test("a still-processing verification never dispatches a replay", async () => {
  let replayCalls = 0;
  const c = client(async (url) => {
    if (String(url).endsWith("/token")) return json({ token });
    if (String(url).includes("/status/"))
      return json(tracking({ status: "processing" }), 202);
    replayCalls++;
    return json(accepted(), 202);
  });
  await assert.rejects(
    c.replayVerificationWebhook(stored),
    isError("not_queued", "not_terminal"),
  );
  assert.equal(replayCalls, 0);
});
test("invalid references and callback override attempts fail before any provider request", async () => {
  let calls = 0;
  const c = client(async () => {
    calls++;
    return json({ token });
  });
  for (const input of [
    null,
    {},
    { ...stored, jobId: "job_123" },
    { ...stored, jobId: stored.jobId + "\n" },
    { ...stored, jobId: stored.jobId + "/../another-job" },
    { ...stored, jobId: "job_" + "i".repeat(26) },
    { ...stored, userId: "unknown" },
    { ...stored, callback_url: "https://another.example.test/callback" },
    { ...stored, callbackUrl: "https://another.example.test/callback" },
  ])
    await assert.rejects(
      c.replayVerificationWebhook(input as any),
      isError("not_queued", "invalid_request"),
    );
  assert.equal(calls, 0);
});
test("failed or mismatched preflight lookup retains the existing job without replay", async () => {
  for (const response of [
    json(tracking({ user_id: "another-user" })),
    json(tracking({ job_id: "job_01h2xcejqtf2nbrexx3vqjhp42" })),
    json(tracking({ status: "processing" }), 200),
    new Response(key, { status: 404 }),
    new Response(key, { status: 500 }),
  ]) {
    let replayCalls = 0;
    const c = client(async (url) => {
      if (String(url).endsWith("/token")) return json({ token });
      if (String(url).includes("/status/")) return response;
      replayCalls++;
      return json(accepted(), 202);
    });
    await assert.rejects(
      c.replayVerificationWebhook(stored),
      isError(
        "not_queued",
        "lookup_failed",
        response.status >= 400 ? response.status : undefined,
      ),
    );
    assert.equal(replayCalls, 0);
  }
});
test("live replay uses only the fixed live API origin", async () => {
  const c = client(async (url) => {
    assert.ok(String(url).startsWith("https://api.smileidentity.com/v3/"));
    if (String(url).endsWith("/token")) return json({ token });
    if (String(url).includes("/status/")) return json(tracking());
    assert.equal(
      url,
      `https://api.smileidentity.com/v3/replay/${stored.jobId}`,
    );
    return json(accepted(), 202);
  }, "live");
  await c.replayVerificationWebhook(stored);
});
test("a lost replay response is unknown and the POST is never automatically repeated", async () => {
  let replayCalls = 0;
  const c = client(async (url) => {
    if (String(url).endsWith("/token")) return json({ token });
    if (String(url).includes("/status/")) return json(tracking());
    replayCalls++;
    throw new Error(`${key} private-provider-detail`);
  });
  await assert.rejects(
    c.replayVerificationWebhook(stored),
    isError("unknown", "unavailable"),
  );
  assert.equal(replayCalls, 1);
});
test("an authoritative replay 409 remains not queued even after a terminal preflight", async () => {
  let replayCalls = 0;
  const c = client(async (url) => {
    if (String(url).endsWith("/token")) return json({ token });
    if (String(url).includes("/status/")) return json(tracking());
    replayCalls++;
    return new Response(key, { status: 409 });
  });
  await assert.rejects(
    c.replayVerificationWebhook(stored),
    isError("not_queued", "not_terminal", 409),
  );
  assert.equal(replayCalls, 1);
});
test("declared replay rejections and uncertain HTTP outcomes never retry; 401 only invalidates its token", async () => {
  for (const httpStatus of [
    400, 401, 403, 404, 415, 200, 204, 301, 429, 500, 503,
  ]) {
    let tokenCalls = 0,
      replayCalls = 0;
    const c = client(async (url) => {
      if (String(url).endsWith("/token")) {
        tokenCalls++;
        return json({ token });
      }
      if (String(url).includes("/status/")) return json(tracking());
      replayCalls++;
      return new Response(httpStatus === 204 ? null : key, {
        status: httpStatus,
      });
    });
    const rejected = [400, 401, 403, 404, 415].includes(httpStatus);
    await assert.rejects(
      c.replayVerificationWebhook(stored),
      isError(
        rejected ? "not_queued" : "unknown",
        httpStatus === 404 ? "not_found" : "provider_error",
        httpStatus,
      ),
    );
    assert.equal(replayCalls, 1);
    assert.equal(tokenCalls, 1);
    await c.getAccessToken();
    assert.equal(tokenCalls, httpStatus === 401 ? 2 : 1);
    assert.equal(replayCalls, 1);
  }
});
test("accepted replay acknowledgement must match both references and include its documented fields", async () => {
  for (const patch of [
    { status: "clear" },
    { job_id: "job_01h2xcejqtf2nbrexx3vqjhp42" },
    { user_id: "another-user" },
    { message: undefined },
    { message: 123 },
  ]) {
    let replayCalls = 0;
    const c = client(async (url) => {
      if (String(url).endsWith("/token")) return json({ token });
      if (String(url).includes("/status/")) return json(tracking());
      replayCalls++;
      return json(accepted(patch), 202);
    });
    await assert.rejects(
      c.replayVerificationWebhook(stored),
      isError("unknown", "invalid_response", 202),
    );
    assert.equal(replayCalls, 1);
  }
});
test("unreadable and oversized replay acknowledgements remain unknown with bounded, sanitized errors", async () => {
  for (const response of [
    new Response(key, { status: 202 }),
    new Response("null", { status: 202 }),
    new Response("[]", { status: 202 }),
    new Response(key, {
      status: 202,
      headers: { "content-length": String(256 * 1024 + 1) },
    }),
    new Response(new Uint8Array(256 * 1024 + 1), { status: 202 }),
    new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error(key));
        },
      }),
      { status: 202 },
    ),
  ]) {
    const c = client(async (url) => {
      if (String(url).endsWith("/token")) return json({ token });
      if (String(url).includes("/status/")) return json(tracking());
      return response;
    });
    await assert.rejects(
      c.replayVerificationWebhook(stored),
      isError("unknown", "invalid_response", 202),
    );
  }
});
test("a failed token refresh after preflight never dispatches replay", async () => {
  let tokenCalls = 0,
    replayCalls = 0;
  let c: SmileIdClient;
  c = client(async (url) => {
    if (String(url).endsWith("/token")) {
      tokenCalls++;
      if (tokenCalls === 1) return json({ token });
      throw new Error(key);
    }
    if (String(url).includes("/status/")) {
      c.invalidateAccessToken();
      return json(tracking());
    }
    replayCalls++;
    return json(accepted(), 202);
  });
  await assert.rejects(
    c.replayVerificationWebhook(stored),
    isError("not_queued", "authentication_unavailable"),
  );
  assert.equal(tokenCalls, 2);
  assert.equal(replayCalls, 0);
});
test("each explicit replay call obtains fresh status; durable deduplication belongs to the caller", async () => {
  let tokenCalls = 0;
  const calls: string[] = [];
  const c = client(async (url) => {
    if (String(url).endsWith("/token")) {
      tokenCalls++;
      return json({ token });
    }
    if (String(url).includes("/status/")) {
      calls.push("status");
      return json(tracking());
    }
    assert.ok(String(url).includes("/replay/"));
    calls.push("replay");
    return json(accepted(), 202);
  });
  await c.replayVerificationWebhook(stored);
  await c.replayVerificationWebhook(stored);
  assert.equal(tokenCalls, 1);
  assert.deepEqual(calls, ["status", "replay", "status", "replay"]);
});
