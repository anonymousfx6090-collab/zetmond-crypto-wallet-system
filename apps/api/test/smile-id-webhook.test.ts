import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { SmileIdClient } from "../src/providers/smile-id.client";
import {
  SmileIdWebhookError,
  SmileIdWebhookHeaders,
  smileIdWebhookFreshnessMs,
} from "../src/providers/smile-id.webhook";

const key = "fixture-webhook-api-key";
const partnerId = "001";
const timestamp = "2026-11-09T12:00:00.000Z";
const nowMillis = Date.parse(timestamp) + 60000;
// Independently calculated with Python's hmac/hashlib/base64 from the supplied
// V3 formula, using only these fixture credentials.
const signature = "+UKN79uQR63V5QFlROflamkjzTzLPr2Ikwq6I8VADIU=";
const stored = {
  jobId: "job_01h2xcejqtf2nbrexx3vqjhp41",
  userId: "user_01h8x9y2z3a4b5c6d7e8f9g0h1",
};
const headers = (patch: SmileIdWebhookHeaders = {}): SmileIdWebhookHeaders => ({
  "Response-Signature": signature,
  "Response-Timestamp": timestamp,
  "smileid-job-id": stored.jobId,
  "user-id": stored.userId,
  ...patch,
});
function client(
  apiKey = key,
  partner = partnerId,
  mode: "sandbox" | "live" = "sandbox",
) {
  return new SmileIdClient({ apiKey, partnerId: partner, mode }, async () => {
    assert.fail("Webhook proof checking must never dispatch a network request");
  });
}
function sign(time: string) {
  return createHmac("sha256", key)
    .update(time + partnerId + "sid_request")
    .digest("base64");
}
const rejected = (error: unknown) =>
  error instanceof SmileIdWebhookError &&
  !error.message.includes(key) &&
  !error.message.includes(signature) &&
  !error.message.includes(stored.userId);

test("documented HMAC matches the independent fixture and yields reconciliation metadata only", () => {
  const result = client().verifyWebhookSignal(headers(), stored, nowMillis);
  assert.deepEqual(result, {
    purpose: "reconcile_only",
    mode: "sandbox",
    ...stored,
    signedAt: timestamp,
    dedupeKey: result.dedupeKey,
  });
  assert.match(result.dedupeKey, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(result).includes(key));
  assert.ok(!JSON.stringify(result).includes(signature));
});
test("HTTP header casing is accepted without changing the proof or dedupe key", () => {
  const c = client();
  const original = headers();
  const lower = Object.fromEntries(
    Object.entries(original).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const upper = Object.fromEntries(
    Object.entries(original).map(([k, v]) => [k.toUpperCase(), v]),
  );
  assert.deepEqual(
    c.verifyWebhookSignal(lower, stored, nowMillis),
    c.verifyWebhookSignal(upper, stored, nowMillis),
  );
});
test("forged, unpadded, noncanonical and malformed Base64 signatures are rejected safely", () => {
  for (const invalid of [
    "0".repeat(43) + "=",
    signature.slice(0, -1),
    signature.slice(0, -2) + "V=", // Same decoded bytes, invalid padding bits.
    "a".repeat(64),
    signature + "\n",
    " " + signature,
    "!".repeat(43) + "=",
    "",
  ])
    assert.throws(
      () =>
        client().verifyWebhookSignal(
          headers({ "Response-Signature": invalid }),
          stored,
          nowMillis,
        ),
      rejected,
    );
});
test("proof requires the original literal API key and partner ID", () => {
  for (const c of [
    client("different-key"),
    client(key, "002"),
    client(Buffer.from(key).toString("base64")),
  ])
    assert.throws(
      () => c.verifyWebhookSignal(headers(), stored, nowMillis),
      rejected,
    );
});
test("correctly signed but stale, future or invalid timestamps fail the local freshness check", () => {
  const c = client();
  for (const time of [
    new Date(nowMillis - smileIdWebhookFreshnessMs - 1).toISOString(),
    new Date(nowMillis + smileIdWebhookFreshnessMs + 1).toISOString(),
    "not-a-date",
    "2026-11-09T12:00:00+24:00",
    timestamp + "\n",
  ])
    assert.throws(
      () =>
        c.verifyWebhookSignal(
          headers({
            "Response-Timestamp": time,
            "Response-Signature": sign(time),
          }),
          stored,
          nowMillis,
        ),
      rejected,
    );
  for (const time of [
    new Date(nowMillis - smileIdWebhookFreshnessMs).toISOString(),
    new Date(nowMillis + smileIdWebhookFreshnessMs).toISOString(),
  ])
    assert.equal(
      c.verifyWebhookSignal(
        headers({
          "Response-Timestamp": time,
          "Response-Signature": sign(time),
        }),
        stored,
        nowMillis,
      ).purpose,
      "reconcile_only",
    );
  for (const invalidClock of [NaN, Infinity])
    assert.throws(
      () => c.verifyWebhookSignal(headers(), stored, invalidClock),
      rejected,
    );
});
test("the exact timestamp string is signed rather than a normalized equivalent", () => {
  const offsetTime = "2026-11-09T13:00:00+01:00";
  const c = client();
  assert.equal(
    c.verifyWebhookSignal(
      headers({
        "Response-Timestamp": offsetTime,
        "Response-Signature": sign(offsetTime),
      }),
      stored,
      nowMillis,
    ).signedAt,
    offsetTime,
  );
  assert.throws(
    () =>
      c.verifyWebhookSignal(
        headers({ "Response-Signature": sign(offsetTime) }),
        stored,
        nowMillis,
      ),
    rejected,
  );
});
test("missing, duplicate and multi-valued proof/correlation headers are rejected", () => {
  for (const name of [
    "Response-Signature",
    "Response-Timestamp",
    "smileid-job-id",
    "user-id",
  ]) {
    for (const value of [
      undefined,
      [],
      [headers()[name]],
      [headers()[name], headers()[name]],
    ])
      assert.throws(
        () =>
          client().verifyWebhookSignal(
            headers({ [name]: value } as any),
            stored,
            nowMillis,
          ),
        rejected,
      );
    assert.throws(
      () =>
        client().verifyWebhookSignal(
          { ...headers(), [name.toUpperCase()]: headers()[name] },
          stored,
          nowMillis,
        ),
      rejected,
    );
  }
});
test("header locators must match an already stored valid job/user pair", () => {
  for (const patch of [
    { "smileid-job-id": "job_01h2xcejqtf2nbrexx3vqjhp42" },
    { "user-id": "another-user" },
    { "user-id": "unknown" },
  ])
    assert.throws(
      () => client().verifyWebhookSignal(headers(patch), stored, nowMillis),
      rejected,
    );
  for (const expected of [
    null,
    {},
    { ...stored, jobId: "job_123" },
    { ...stored, userId: "unknown" },
  ])
    assert.throws(
      () => client().verifyWebhookSignal(headers(), expected as any, nowMillis),
      rejected,
    );
});
test("the documented proof does not bind job/user IDs or environment and can only yield a lookup signal", () => {
  const first = client().verifyWebhookSignal(headers(), stored, nowMillis);
  const another = {
    jobId: "job_01h2xcejqtf2nbrexx3vqjhp42",
    userId: "another-stored-user",
  };
  const second = client().verifyWebhookSignal(
    headers({ "smileid-job-id": another.jobId, "user-id": another.userId }),
    another,
    nowMillis,
  );
  // Intentionally reusing fixture credentials demonstrates the formula's scope,
  // not mode isolation. Actual jobs must retain their original mode/credential.
  const live = client(key, partnerId, "live").verifyWebhookSignal(
    headers(),
    stored,
    nowMillis,
  );
  for (const result of [first, second, live]) {
    assert.equal(result.purpose, "reconcile_only");
    assert.ok(!("status" in result));
    assert.ok(!("evidence" in result));
    assert.ok(!("revision" in result));
  }
  assert.notEqual(first.dedupeKey, second.dedupeKey);
  assert.notEqual(first.dedupeKey, live.dedupeKey);
});
test("repeated proof checking is deterministic; durable inbox deduplication is a separate obligation", () => {
  const c = client();
  const first = c.verifyWebhookSignal(headers(), stored, nowMillis);
  const duplicate = c.verifyWebhookSignal(headers(), stored, nowMillis + 1);
  assert.equal(first.dedupeKey, duplicate.dedupeKey);
  const nextTime = "2026-11-09T12:00:01.000Z";
  const next = c.verifyWebhookSignal(
    headers({
      "Response-Timestamp": nextTime,
      "Response-Signature": sign(nextTime),
    }),
    stored,
    nowMillis,
  );
  assert.notEqual(first.dedupeKey, next.dedupeKey);
});
