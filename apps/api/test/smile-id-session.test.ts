import { test } from "node:test";
import assert from "node:assert/strict";
import { SmileIdClient } from "../src/providers/smile-id.client";
import {
  prepareSmileIdDocumentSession,
  SmileIdDocumentSessionRequest,
  SmileIdSessionError,
} from "../src/providers/smile-id.session";

const key = "fixture-session-api-key";
function jwt(label = "session") {
  return [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
    Buffer.from(JSON.stringify({ fixture: label })).toString("base64url"),
    Buffer.from("fixture-signature").toString("base64url"),
  ].join(".");
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
function input(
  patch: Partial<SmileIdDocumentSessionRequest> = {},
): SmileIdDocumentSessionRequest {
  return {
    operationId: "79d95e70-bf87-4e4d-a6a5-4e9c0f69a373",
    userId: "fixture_customer",
    country: "NG",
    email: "fixture@example.test",
    callbackUrl: "https://api.example.test/webhooks/private-fixture-capability",
    ...patch,
  };
}
const notice = (grantedAt = new Date(Date.now() - 60000).toISOString()) => ({
  granted: true as const,
  granted_at: grantedAt,
  notice_language: "EN",
  notice_privacy_policy_url: "https://app.example.test/privacy",
});
function client(
  transport: typeof fetch,
  mode: "sandbox" | "live" = "sandbox",
  now?: () => number,
) {
  return new SmileIdClient(
    { partnerId: "123", apiKey: key, mode },
    transport,
    now,
  );
}
const isError = (code: SmileIdSessionError["code"]) => (error: unknown) =>
  error instanceof SmileIdSessionError &&
  error.code === code &&
  !error.message.includes(key) &&
  !error.message.includes("fixture@example.test") &&
  !error.message.includes("private-fixture-capability") &&
  !error.message.includes(jwt());

test("document session token request binds subject, country, email, callback and operation using native multipart", async () => {
  let calls = 0;
  const d = input();
  const c = client(async (url, options) => {
    calls++;
    assert.equal(url, "https://testapi.smileidentity.com/v3/token");
    assert.equal(options?.method, "POST");
    assert.equal(options?.redirect, "error");
    assert.equal(options?.credentials, "omit");
    assert.ok(options?.signal);
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("smileid-partner-id"), "123");
    assert.equal(headers.get("smileid-api-key"), key);
    assert.equal(headers.get("content-type"), null);
    assert.ok(options?.body instanceof FormData);
    const request = new Request(String(url), options);
    assert.match(
      request.headers.get("content-type")!,
      /^multipart\/form-data; boundary=/,
    );
    const form = await request.formData();
    assert.equal(form.get("user_id"), d.userId);
    assert.equal(form.get("product"), "document_verification");
    assert.deepEqual(JSON.parse(String(form.get("partner_params"))), {
      zetmond_operation_id: d.operationId,
    });
    assert.deepEqual(JSON.parse(String(form.get("payload"))), {
      country: "NG",
      email: d.email,
      callback_url: d.callbackUrl,
    });
    assert.equal(form.get("use_enrolled_image"), null);
    assert.equal(form.get("allow_new_enroll"), null);
    return json({ token: jwt(), private_extra: d });
  });
  assert.equal(await c.issueDocumentSessionToken(d), jwt());
  assert.equal(calls, 1);
});
test("concurrent customer sessions mint separately and cannot consume or replace the cached lookup token", async () => {
  let lookupCalls = 0,
    sessionCalls = 0;
  const observed: { user: FormDataEntryValue | null; email: string }[] = [];
  const c = client(async (_, options) => {
    if (!options?.body) {
      lookupCalls++;
      return json({ token: jwt("lookup") });
    }
    const form = options.body as FormData;
    observed.push({
      user: form.get("user_id"),
      email: JSON.parse(String(form.get("payload"))).email,
    });
    return json({ token: jwt(String(++sessionCalls)) });
  });
  const cached = await c.getAccessToken();
  const results = await Promise.all([
    c.issueDocumentSessionToken(input()),
    c.issueDocumentSessionToken(
      input({
        operationId: "79d95e70-bf87-4e4d-a6a5-4e9c0f69a374",
        userId: "another_customer",
        email: "another@example.test",
      }),
    ),
  ]);
  assert.equal(new Set(results).size, 2);
  assert.ok(results.every((value) => value !== cached));
  assert.deepEqual(observed, [
    { user: "fixture_customer", email: "fixture@example.test" },
    { user: "another_customer", email: "another@example.test" },
  ]);
  assert.equal(await c.getAccessToken(), cached);
  assert.equal(sessionCalls, 2);
  assert.equal(lookupCalls, 1);
});
test("unprovided consent, names and ID type are omitted rather than synthesized", () => {
  const form = prepareSmileIdDocumentSession(input());
  const payload = JSON.parse(String(form.get("payload")));
  for (const key of [
    "consent",
    "given_names",
    "last_name",
    "id_type",
    "phone_number",
    "id_number",
  ])
    assert.ok(!(key in payload));
});
test("optional name, ID type and genuine consent bind to their documented payload names", async () => {
  const consent = notice();
  const c = client(async (_, options) => {
    const payload = JSON.parse(
      String((options!.body as FormData).get("payload")),
    );
    assert.equal(payload.given_names, "Fixture Given");
    assert.equal(payload.last_name, "Fixture Last");
    assert.equal(payload.id_type, "PASSPORT");
    assert.deepEqual(payload.consent, consent);
    return json({ token: jwt() });
  });
  await c.issueDocumentSessionToken(
    input({
      givenNames: " Fixture Given ",
      lastName: "Fixture Last",
      idType: "PASSPORT",
      consent,
    }),
  );
});
test("invalid context, extra payloads and capture-bypass/re-enrolment grants fail before network access", async () => {
  let calls = 0;
  const c = client(async () => {
    calls++;
    return json({ token: jwt() });
  });
  for (const d of [
    null,
    {},
    input({ operationId: "invalid" }),
    input({ userId: "unknown" }),
    input({ userId: "fixture\n" }),
    input({ email: "invalid" }),
    input({ country: "US" as any }),
    input({ country: "ZA" as any }),
    input({ callbackUrl: "http://api.example.test/callback" }),
    input({ callbackUrl: "https://user:private@api.example.test/callback" }),
    input({ callbackUrl: "callback_unverified_reference" }),
    { ...input(), product: "smart_selfie_registration" },
    { ...input(), use_enrolled_image: true },
    { ...input(), allow_new_enroll: true },
    { ...input(), payload: { country: "US" } },
    { ...input(), partner_params: { zetmond_operation_id: "another-attempt" } },
  ])
    await assert.rejects(
      c.issueDocumentSessionToken(d as any),
      isError("invalid_request"),
    );
  assert.equal(calls, 0);
});
test("local consent policy rejects false/incomplete/extra fields and unsafe notice values", async () => {
  let calls = 0;
  const c = client(async () => {
    calls++;
    return json({ token: jwt() });
  });
  for (const consent of [
    { ...notice(), granted: false },
    { ...notice(), granted_at: undefined },
    { ...notice(), notice_language: "en" },
    { ...notice(), notice_language: "EN\n" },
    {
      ...notice(),
      notice_privacy_policy_url: "http://app.example.test/privacy",
    },
    { ...notice(), extra: true },
  ])
    await assert.rejects(
      c.issueDocumentSessionToken(input({ consent } as any)),
      isError("invalid_request"),
    );
  assert.equal(calls, 0);
});
test("consent accepts at most one minute of future clock skew", () => {
  const now = Date.parse("2026-11-09T12:00:00.000Z");
  assert.ok(
    prepareSmileIdDocumentSession(
      input({ consent: notice(new Date(now + 60000).toISOString()) }),
      now,
    ) instanceof FormData,
  );
  assert.throws(
    () =>
      prepareSmileIdDocumentSession(
        input({ consent: notice(new Date(now + 60001).toISOString()) }),
        now,
      ),
    isError("invalid_request"),
  );
  assert.throws(
    () => prepareSmileIdDocumentSession(input(), NaN),
    isError("invalid_request"),
  );
});
test("country bindings stay explicit for every enabled launch market", async () => {
  for (const country of ["NG", "GH", "KE"] as const) {
    const c = client(async (_, options) => {
      assert.equal(
        JSON.parse(String((options!.body as FormData).get("payload"))).country,
        country,
      );
      return json({ token: jwt(country) });
    });
    assert.equal(
      await c.issueDocumentSessionToken(input({ country })),
      jwt(country),
    );
  }
});
test("live session tokens are minted only on the fixed live token origin", async () => {
  const c = client(async (url, options) => {
    assert.equal(url, "https://api.smileidentity.com/v3/token");
    assert.equal(
      (options!.body as FormData).get("product"),
      "document_verification",
    );
    return json({ token: jwt("live") });
  }, "live");
  assert.equal(await c.issueDocumentSessionToken(input()), jwt("live"));
});
test("provider/transport failures are sanitized, never retried and never fall back to the cached server token", async () => {
  for (const status of [400, 401, 415, 500, "network"] as const) {
    let sessionCalls = 0,
      lookupCalls = 0;
    const c = client(async (_, options) => {
      if (!options?.body) {
        lookupCalls++;
        return json({ token: jwt("lookup") });
      }
      sessionCalls++;
      if (status === "network")
        throw new Error(key + " private-fixture-capability");
      return new Response(key, { status });
    });
    const cached = await c.getAccessToken();
    await assert.rejects(
      c.issueDocumentSessionToken(input()),
      isError("issuance_failed"),
    );
    assert.equal(await c.getAccessToken(), cached);
    assert.equal(sessionCalls, 1);
    assert.equal(lookupCalls, 1);
  }
});
test("malformed or oversized provider token replies never become a browser session token", async () => {
  for (const response of [
    json({}),
    json({ token: "not-a-jwt" }),
    json({ token: jwt() + "\n" }),
    new Response(key),
    new Response(key, {
      headers: { "content-length": String(256 * 1024 + 1) },
    }),
  ]) {
    const c = client(async () => response);
    await assert.rejects(
      c.issueDocumentSessionToken(input()),
      isError("issuance_failed"),
    );
  }
});
test("late-issued tokens are rejected and oversized input never reaches the provider", async () => {
  let now = 0,
    sessionCalls = 0;
  const c = client(
    async () => {
      sessionCalls++;
      now = 14 * 60 * 1000;
      return json({ token: jwt() });
    },
    "sandbox",
    () => now,
  );
  await assert.rejects(
    c.issueDocumentSessionToken(input()),
    isError("expired"),
  );
  assert.equal(sessionCalls, 1);
  for (const d of [
    input({ givenNames: "x".repeat(201) }),
    input({ callbackUrl: "https://api.example.test/" + "x".repeat(2048) }),
    input({
      consent: notice("2026-11-09T12:00:00." + "0".repeat(20000) + "Z"),
    }),
  ])
    await assert.rejects(
      c.issueDocumentSessionToken(d),
      isError("invalid_request"),
    );
  assert.equal(sessionCalls, 1);
});
