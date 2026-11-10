import { test } from "node:test";
import assert from "node:assert/strict";
import { SmileIdClient } from "../src/providers/smile-id.client";
import {
  documentTransportLimits,
  SmileIdDocumentRequest,
  SmileIdSubmissionError,
} from "../src/providers/smile-id.document";
const key = "fixture-api-key",
  token = "e30.eyJmaXh0dXJlIjp0cnVlfQ.c2ln";
const jobId = "job_01h8x9y2z3a4b5c6d7e8f9g0h1";
const jpegBytes = new Uint8Array([255, 216, 255, 224]);
const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const jpeg = () =>
  new File([jpegBytes], "private-original-name.jpg", { type: "image/jpeg" });
const png = () =>
  new File([pngBytes], "private-original-name.png", { type: "image/png" });
function input(
  patch: Partial<SmileIdDocumentRequest> = {},
): SmileIdDocumentRequest {
  return {
    operationId: "79d95e70-bf87-4e4d-a6a5-4e9c0f69a373",
    userId: "zetmond_fixture_user",
    email: "fixture@example.test",
    country: "NG",
    callbackUrl: "https://api.example.test/callback",
    consent: {
      granted: true,
      granted_at: "2026-11-09T10:00:00.000Z",
      notice_language: "EN",
      notice_privacy_policy_url: "https://app.example.test/privacy",
    },
    document: png(),
    documentBack: jpeg(),
    selfieImage: jpeg(),
    livenessImages: Array.from({ length: 6 }, jpeg),
    partnerParams: { order_id: "fixture-order" },
    ...patch,
  };
}
function accepted(patch: Record<string, unknown> = {}) {
  return {
    status: "accepted",
    message: "fixture-provider-detail",
    job_id: jobId,
    user_id: "zetmond_fixture_user",
    created_at: "2026-11-09T10:01:00.000Z",
    ...patch,
  };
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status });
}
function client(transport: typeof fetch, mode: "sandbox" | "live" = "sandbox") {
  return new SmileIdClient({ partnerId: "123", apiKey: key, mode }, transport);
}
const isOutcome = (outcome: "not_submitted" | "unknown") => (error: unknown) =>
  error instanceof SmileIdSubmissionError &&
  error.outcome === outcome &&
  !error.message.includes(key) &&
  !error.message.includes("fixture@example.test");

test("document submission sends native multipart images, consent and stable correlation, not a manual content type", async () => {
  let calls = 0;
  const payload = input();
  const c = client(async (url, options) => {
    calls++;
    if (String(url).endsWith("/token")) return json({ token });
    assert.equal(
      url,
      "https://testapi.smileidentity.com/v3/document_verification",
    );
    assert.equal(options?.method, "POST");
    assert.equal(options?.redirect, "error");
    assert.equal(options?.credentials, "omit");
    assert.ok(options?.signal);
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("smileid-partner-id"), "123");
    assert.equal(headers.get("smileid-token"), token);
    assert.equal(headers.get("smileid-api-key"), null);
    assert.equal(headers.get("content-type"), null);
    assert.ok(options?.body instanceof FormData);
    // Round trip through the platform encoder; the test does not invent a vendor consent fixture.
    const request = new Request(String(url), options);
    assert.match(
      request.headers.get("content-type")!,
      /^multipart\/form-data; boundary=/,
    );
    const form = await request.formData();
    assert.equal(form.get("user_id"), payload.userId);
    assert.equal(form.get("country"), "NG");
    assert.equal(form.get("callback_url"), payload.callbackUrl);
    assert.deepEqual(JSON.parse(String(form.get("consent"))), payload.consent);
    assert.deepEqual(JSON.parse(String(form.get("user_details"))), {
      email: payload.email,
    });
    assert.deepEqual(JSON.parse(String(form.get("partner_params"))), {
      order_id: "fixture-order",
      zetmond_operation_id: payload.operationId,
    });
    assert.equal(form.getAll("liveness_images").length, 6);
    assert.equal(form.get("id_type"), null);
    assert.equal((form.get("document") as File).name, "document.png");
    assert.equal((form.get("document_back") as File).name, "document-back.jpg");
    assert.equal((form.get("selfie_image") as File).name, "selfie.jpg");
    assert.deepEqual(
      new Uint8Array(await (form.get("document") as File).arrayBuffer()),
      pngBytes,
    );
    for (const [i, frame] of form.getAll("liveness_images").entries())
      assert.equal((frame as File).name, `liveness-${i + 1}.jpg`);
    return json(accepted({ image_links: { private: "fixture-secret" } }), 202);
  });
  const result = await c.submitDocumentVerification(payload);
  assert.deepEqual(result, {
    status: "accepted",
    operationId: payload.operationId,
    jobId,
    userId: payload.userId,
    createdAt: "2026-11-09T10:01:00.000Z",
  });
  assert.ok(!JSON.stringify(result).includes("fixture-provider-detail"));
  assert.ok(!JSON.stringify(result).includes("fixture-secret"));
  assert.notEqual(result.operationId, result.jobId);
  assert.equal(calls, 2);
});
test("fresh-image path allows six through eight frames, optional document back and optional document type", async () => {
  for (const count of [6, 7, 8]) {
    const payload = input({
      livenessImages: Array.from({ length: count }, jpeg),
      documentBack: undefined,
      idType: "DRIVERS_LICENSE",
    });
    const c = client(async (url, options) => {
      if (String(url).endsWith("/token")) return json({ token });
      const form = options!.body as FormData;
      assert.equal(form.getAll("liveness_images").length, count);
      assert.equal(form.get("document_back"), null);
      assert.equal(form.get("id_type"), "DRIVERS_LICENSE");
      return json(accepted(), 202);
    });
    await c.submitDocumentVerification(payload);
  }
});
test("live submission stays on the live origin", async () => {
  const c = client(async (url) => {
    assert.ok(String(url).startsWith("https://api.smileidentity.com/v3/"));
    return String(url).endsWith("/token")
      ? json({ token })
      : json(accepted(), 202);
  }, "live");
  await c.submitDocumentVerification(input());
});
test("missing fresh images and incorrect frame counts are rejected before authentication", async () => {
  let calls = 0;
  const c = client(async () => {
    calls++;
    return json({ token });
  });
  for (const patch of [
    { selfieImage: undefined },
    { document: undefined },
    { livenessImages: [] },
    { livenessImages: Array.from({ length: 5 }, jpeg) },
    { livenessImages: Array.from({ length: 9 }, jpeg) },
  ])
    await assert.rejects(
      c.submitDocumentVerification(input(patch as any)),
      isOutcome("not_submitted"),
    );
  assert.equal(calls, 0);
});
test("false/incomplete consent, invalid subject data and insecure callbacks are not submitted", async () => {
  let calls = 0;
  const c = client(async () => {
    calls++;
    return json({ token });
  });
  const base = input();
  for (const patch of [
    { consent: { ...base.consent, granted: false } },
    { consent: { ...base.consent, granted_at: "not-a-date" } },
    { consent: { ...base.consent, notice_language: "en" } },
    { consent: { ...base.consent, notice_language: "EN\n" } },
    {
      consent: {
        ...base.consent,
        notice_privacy_policy_url: "http://app.example.test/privacy",
      },
    },
    { consent: undefined },
    { email: "invalid" },
    { country: "US" },
    { userId: "person@example.test" },
    { userId: "unknown" },
    { userId: "customer\n" },
    { callbackUrl: "http://api.example.test/callback" },
    { callbackUrl: "https://user:private-password@api.example.test/callback" },
  ])
    await assert.rejects(
      c.submitDocumentVerification(input(patch as any)),
      isOutcome("not_submitted"),
    );
  assert.equal(calls, 0);
});
test("MIME/signature mismatches and unsupported raw-image encodings are rejected", async () => {
  let calls = 0;
  const c = client(async () => {
    calls++;
    return json({ token });
  });
  for (const patch of [
    { selfieImage: png() },
    { document: new Blob(["not-an-image"], { type: "image/jpeg" }) },
    { document: new Blob([jpegBytes], { type: "image/png" }) },
    { document: new Blob(["%PDF"], { type: "application/pdf" }) },
    { livenessImages: [png(), ...Array.from({ length: 5 }, jpeg)] },
  ])
    await assert.rejects(
      c.submitDocumentVerification(input(patch)),
      isOutcome("not_submitted"),
    );
  await assert.rejects(
    c.submitDocumentVerification({
      ...input(),
      encrypted_package: "fixture",
    } as any),
    isOutcome("not_submitted"),
  );
  assert.equal(calls, 0);
});
test("image and metadata budgets prevent an outbound request", async () => {
  let calls = 0;
  const c = client(async () => {
    calls++;
    return json({ token });
  });
  const huge = new Blob(
    [jpegBytes, new Uint8Array(documentTransportLimits.imageBytes)],
    { type: "image/jpeg" },
  );
  await assert.rejects(
    c.submitDocumentVerification(input({ document: huge })),
    isOutcome("not_submitted"),
  );
  const shared = new Blob([jpegBytes, new Uint8Array(8 * 1024 * 1024)], {
    type: "image/jpeg",
  });
  await assert.rejects(
    c.submitDocumentVerification(
      input({ livenessImages: Array(6).fill(shared) }),
    ),
    isOutcome("not_submitted"),
  );
  await assert.rejects(
    c.submitDocumentVerification(
      input({
        partnerParams: {
          large: "x".repeat(documentTransportLimits.metadataBytes),
        },
      }),
    ),
    isOutcome("not_submitted"),
  );
  const circular: any = {};
  circular.self = circular;
  await assert.rejects(
    c.submitDocumentVerification(input({ partnerParams: circular })),
    isOutcome("not_submitted"),
  );
  assert.equal(calls, 0);
});
test("caller metadata cannot substitute another internal operation", async () => {
  let calls = 0;
  const c = client(async () => {
    calls++;
    return json({ token });
  });
  await assert.rejects(
    c.submitDocumentVerification(
      input({ partnerParams: { zetmond_operation_id: "another-operation" } }),
    ),
    isOutcome("not_submitted"),
  );
  assert.equal(calls, 0);
});
test("authentication failure is distinguished from an uncertain document upload", async () => {
  let docCalls = 0;
  const c = client(async (url) => {
    if (String(url).endsWith("/token")) throw new Error(key);
    docCalls++;
    return json({});
  });
  await assert.rejects(
    c.submitDocumentVerification(input()),
    isOutcome("not_submitted"),
  );
  assert.equal(docCalls, 0);
});
test("a lost upload response is unknown and is never retried automatically", async () => {
  let docCalls = 0;
  const c = client(async (url) => {
    if (String(url).endsWith("/token")) return json({ token });
    docCalls++;
    throw new Error(key);
  });
  await assert.rejects(
    c.submitDocumentVerification(input()),
    isOutcome("unknown"),
  );
  assert.equal(docCalls, 1);
});
test("unexpected document responses never replay the request or evict an unrelated lookup token", async () => {
  for (const status of [200, 400, 401, 403, 415, 429, 500]) {
    let tokenCalls = 0,
      docCalls = 0;
    const c = client(async (url) => {
      if (String(url).endsWith("/token")) {
        tokenCalls++;
        return json({ token: token + String(tokenCalls) });
      }
      docCalls++;
      return new Response(key, { status });
    });
    const cachedLookupToken = await c.getAccessToken();
    await assert.rejects(
      c.submitDocumentVerification(input()),
      isOutcome("unknown"),
    );
    assert.equal(docCalls, 1);
    assert.equal(tokenCalls, 2);
    assert.equal(await c.getAccessToken(), cachedLookupToken);
    assert.equal(tokenCalls, 2);
    assert.equal(docCalls, 1);
  }
});
test("each new document submission gets its own fresh token without sharing or replacing the lookup cache", async () => {
  let tokenCalls = 0;
  const submittedTokens: string[] = [];
  const c = client(async (url, options) => {
    if (String(url).endsWith("/token"))
      return json({ token: token + String(++tokenCalls) });
    submittedTokens.push(new Headers(options?.headers).get("smileid-token")!);
    const user = (options?.body as FormData).get("user_id");
    return json(accepted({ user_id: user }), 202);
  });
  const cached = await c.getAccessToken();
  await Promise.all([
    c.submitDocumentVerification(input()),
    c.submitDocumentVerification(
      input({
        operationId: "79d95e70-bf87-4e4d-a6a5-4e9c0f69a374",
        userId: "zetmond_fixture_user_2",
      }),
    ),
  ]);
  assert.equal(tokenCalls, 3);
  assert.equal(new Set(submittedTokens).size, 2);
  assert.ok(submittedTokens.every((value) => value !== cached));
  assert.equal(await c.getAccessToken(), cached);
  assert.equal(tokenCalls, 3);
});
test("202 acceptance is not approval and must match the supplied subject and valid tracking fields", async () => {
  for (const patch of [
    { status: "clear" },
    { user_id: "another-user" },
    { created_at: "invalid" },
    { job_id: undefined },
  ]) {
    const c = client(async (url) =>
      String(url).endsWith("/token")
        ? json({ token })
        : json(accepted(patch), 202),
    );
    await assert.rejects(
      c.submitDocumentVerification(input()),
      (error: unknown) =>
        isOutcome("unknown")(error) &&
        (error as SmileIdSubmissionError).providerJobId ===
          (patch.job_id === undefined && "job_id" in patch ? undefined : jobId),
    );
  }
});
test("an unreadable acceptance is unknown and never exposes the response body", async () => {
  let docCalls = 0;
  const c = client(async (url) => {
    if (String(url).endsWith("/token")) return json({ token });
    docCalls++;
    return new Response(key, { status: 202 });
  });
  await assert.rejects(
    c.submitDocumentVerification(input()),
    isOutcome("unknown"),
  );
  assert.equal(docCalls, 1);
});
test("submission tracking accepts the documented V3 status job identifier", async () => {
  const documentedJobId = "job_01h2xcejqtf2nbrexx3vqjhp41";
  const c = client(async (url) =>
    String(url).endsWith("/token")
      ? json({ token })
      : json(accepted({ job_id: documentedJobId }), 202),
  );
  const result = await c.submitDocumentVerification(input());
  assert.equal(result.jobId, documentedJobId);
  assert.equal(result.status, "accepted");
});
test("invalid TypeIDs never become usable submission job references or trigger replay", async () => {
  for (const malformedJobId of [
    "job_123",
    jobId + "0",
    jobId.slice(0, -1),
    jobId.toUpperCase(),
    jobId.replace("job_", "user_"),
    "job_" + "i".repeat(26),
    "job_" + "l".repeat(26),
    "job_" + "o".repeat(26),
    "job_" + "u".repeat(26),
    jobId + "\n",
    jobId + "\r\n",
    " " + jobId,
    jobId + "/../another-job",
    jobId + "?user_id=another-user",
  ]) {
    let docCalls = 0;
    const c = client(async (url) => {
      if (String(url).endsWith("/token")) return json({ token });
      docCalls++;
      return json(accepted({ job_id: malformedJobId }), 202);
    });
    await assert.rejects(
      c.submitDocumentVerification(input()),
      (error: unknown) =>
        isOutcome("unknown")(error) &&
        (error as SmileIdSubmissionError).providerJobId === undefined,
    );
    assert.equal(docCalls, 1);
  }
});
