import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfigurationError } from "../src/config";
import {
  PaystackBankLookupClient,
  PaystackLookupError,
} from "../src/providers/paystack.client";
import {
  checkPaystackBankAccess,
  reportConfiguredPaystackBankAccess,
} from "../src/check-paystack";

const secretKey = "sk_test_" + "f".repeat(40);
const bank = {
  id: 9,
  code: "007",
  name: "Fixture Nigerian Bank",
  country: "Nigeria",
  currency: "NGN",
  type: "nuban",
  active: true,
  is_deleted: false,
};
const account = { bankCode: "007", accountNumber: "0123456789" };
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const fails = (code: string) => (error: unknown) =>
  error instanceof PaystackLookupError && error.code === code;

test("Paystack catalog stays server-side, Nigeria/NGN/NUBAN-scoped and excludes unsupported or inactive entries", async () => {
  const client = new PaystackBankLookupClient(
    { mode: "sandbox", secretKey },
    async (url, options) => {
      const u = new URL(String(url));
      assert.equal(u.origin, "https://api.paystack.co");
      assert.equal(u.pathname, "/bank");
      assert.deepEqual(Object.fromEntries(u.searchParams), {
        country: "nigeria",
        currency: "NGN",
        type: "nuban",
        use_cursor: "false",
        perPage: "100",
        page: "1",
      });
      assert.equal(options!.method, "GET");
      assert.equal(options!.redirect, "error");
      assert.equal(
        (options!.headers as Record<string, string>).Authorization,
        `Bearer ${secretKey}`,
      );
      assert.ok(options!.signal);
      return json({
        status: true,
        data: [
          bank,
          { ...bank, id: 10, code: "008", country: "Ghana", currency: "GHS" },
          { ...bank, id: 11, code: "009", active: false },
          { ...bank, id: 12, code: "010", is_deleted: true },
          { ...bank, id: 13, code: "011", type: "mobile_money" },
        ],
      });
    },
  );
  assert.deepEqual(await client.listNigerianBanks(), [
    { code: bank.code, name: bank.name },
  ]);
  assert.ok(!JSON.stringify(client).includes(secretKey));
});

test("account resolution preserves leading zeros and binds the returned account and bank to the Nigerian catalogue", async () => {
  let calls = 0;
  const client = new PaystackBankLookupClient(
    { mode: "sandbox", secretKey },
    async (url) => {
      calls++;
      const u = new URL(String(url));
      if (u.pathname === "/bank") return json({ status: true, data: [bank] });
      assert.equal(u.pathname, "/bank/resolve");
      assert.equal(u.searchParams.get("account_number"), "0123456789");
      assert.equal(u.searchParams.get("bank_code"), "007");
      return json({
        status: true,
        data: {
          account_number: account.accountNumber,
          account_name: "Fixture Holder",
          bank_id: bank.id,
        },
      });
    },
  );
  const result = await client.resolveNigerianAccount(account);
  assert.deepEqual(result, { ...account, accountName: "Fixture Holder" });
  assert.equal("ownershipVerified" in result, false);
  assert.equal("verified" in result, false);
  assert.equal(calls, 2);
});

test("numeric, malformed and extra account fields are refused before any request", async () => {
  let calls = 0;
  const client = new PaystackBankLookupClient(
    { mode: "sandbox", secretKey },
    async () => {
      calls++;
      throw new Error("must not request");
    },
  );
  for (const input of [
    { ...account, accountNumber: 123456789 },
    { ...account, bankCode: 7 },
    { ...account, accountNumber: "1234" },
    { ...account, bankCode: "https://elsewhere.test" },
    { ...account, ownershipVerified: true },
  ])
    await assert.rejects(
      client.resolveNigerianAccount(input as any),
      fails("invalid_request"),
    );
  assert.equal(calls, 0);
});

test("a code outside the usable Nigerian bank list cannot be resolved", async () => {
  let calls = 0;
  const client = new PaystackBankLookupClient(
    { mode: "sandbox", secretKey },
    async () => {
      calls++;
      return json({
        status: true,
        data: [{ ...bank, country: "Kenya", currency: "KES" }],
      });
    },
  );
  await assert.rejects(
    client.resolveNigerianAccount(account),
    fails("invalid_request"),
  );
  assert.equal(calls, 1);
});

test("lookup rejects contradictory account numbers, wrong bank IDs and malformed provider evidence", async () => {
  for (const patch of [
    { account_number: "1111111111" },
    { account_number: 123456789 },
    { bank_id: 99 },
    { account_name: "" },
    { account_name: "Holder\nName" },
  ]) {
    const client = new PaystackBankLookupClient(
      { mode: "sandbox", secretKey },
      async (url) =>
        new URL(String(url)).pathname === "/bank"
          ? json({ status: true, data: [bank] })
          : json({
              status: true,
              data: {
                account_number: account.accountNumber,
                account_name: "Fixture Holder",
                bank_id: bank.id,
                ...patch,
              },
            }),
    );
    await assert.rejects(
      client.resolveNigerianAccount(account),
      fails("invalid_response"),
    );
  }
});

test("HTTP failures never expose provider messages or trigger automatic retries", async () => {
  for (const status of [401, 403, 404, 429, 500, 503, 202]) {
    let calls = 0;
    const client = new PaystackBankLookupClient(
      { mode: "sandbox", secretKey },
      async () => {
        calls++;
        return json(
          {
            status: false,
            message: `${secretKey} ${account.accountNumber} private-holder`,
          },
          status,
        );
      },
    );
    await assert.rejects(client.listNigerianBanks(), (error: unknown) => {
      assert.ok(error instanceof PaystackLookupError);
      assert.equal(
        error.code,
        [401, 403].includes(status)
          ? "authentication_failed"
          : "provider_unavailable",
      );
      assert.ok(!error.message.includes(secretKey));
      assert.ok(!error.message.includes(account.accountNumber));
      assert.ok(!error.message.includes("private-holder"));
      return true;
    });
    assert.equal(calls, 1);
  }
});

test("public keys, environment mismatch and malformed settings do not become API requests", () => {
  for (const credentials of [
    { mode: "sandbox", secretKey: "pk_test_" + "f".repeat(40) },
    { mode: "live", secretKey },
    { mode: "sandbox", secretKey: "sk_live_" + "f".repeat(40) },
    { mode: "other", secretKey },
    { mode: "sandbox", secretKey: "private-wrong-value" },
  ]) {
    assert.throws(
      () => new PaystackBankLookupClient(credentials as any),
      (error: unknown) => {
        assert.ok(error instanceof ConfigurationError);
        assert.ok(!error.message.includes(credentials.secretKey));
        return true;
      },
    );
  }
});

test("live lookup also uses the fixed Paystack host with the matching server key", async () => {
  const live = "sk_live_" + "a".repeat(40);
  const client = new PaystackBankLookupClient(
    { mode: "live", secretKey: live },
    async (url, options) => {
      assert.equal(new URL(String(url)).origin, "https://api.paystack.co");
      assert.equal(
        (options!.headers as Record<string, string>).Authorization,
        `Bearer ${live}`,
      );
      return json({ status: true, data: [bank] });
    },
  );
  assert.equal((await client.listNigerianBanks()).length, 1);
});

test("offset pagination covers the catalogue and retains bank codes as strings", async () => {
  const full = Array.from({ length: 100 }, (_, index) => ({
    ...bank,
    id: index + 1,
    code: String(index).padStart(3, "0"),
  }));
  const pages: string[] = [];
  const client = new PaystackBankLookupClient(
    { mode: "sandbox", secretKey },
    async (url) => {
      const page = new URL(String(url)).searchParams.get("page")!;
      pages.push(page);
      return json({
        status: true,
        data: page === "1" ? full : [{ ...bank, id: 101, code: "100" }],
      });
    },
  );
  const banks = await client.listNigerianBanks();
  assert.equal(banks.length, 101);
  assert.equal(banks[0].code, "000");
  assert.deepEqual(pages, ["1", "2"]);
});

test("ignored pagination, conflicting codes and an endless catalogue fail without returning partial data", async () => {
  const full = Array.from({ length: 100 }, (_, index) => ({
    ...bank,
    id: index + 1,
    code: String(index).padStart(3, "0"),
  }));
  let calls = 0;
  const repeated = new PaystackBankLookupClient(
    { mode: "sandbox", secretKey },
    async () => {
      calls++;
      return json({ status: true, data: full });
    },
  );
  await assert.rejects(repeated.listNigerianBanks(), fails("invalid_response"));
  assert.equal(calls, 2);
  calls = 0;
  const endless = new PaystackBankLookupClient(
    { mode: "sandbox", secretKey },
    async () => {
      const offset = calls++ * 100;
      return json({
        status: true,
        data: full.map((b, index) => ({
          ...b,
          id: offset + index + 1,
          code: String(offset + index).padStart(4, "0"),
        })),
      });
    },
  );
  await assert.rejects(endless.listNigerianBanks(), fails("invalid_response"));
  assert.equal(calls, 10);
});

test("malformed, oversized and redirected responses are refused", async () => {
  const factories = [
    () => json({ status: false, message: secretKey }),
    () => new Response("not JSON"),
    () => new Response("x".repeat(256 * 1024 + 1)),
    () =>
      new Response("{}", {
        headers: { "Content-Length": String(256 * 1024 + 1) },
      }),
    () => {
      const response = json({ status: true, data: [bank] });
      Object.defineProperty(response, "redirected", { value: true });
      return response;
    },
    () => json({ status: true, data: [{ ...bank, code: 7 }] }),
  ];
  for (const factory of factories) {
    const client = new PaystackBankLookupClient(
      { mode: "sandbox", secretKey },
      async () => factory(),
    );
    await assert.rejects(client.listNigerianBanks(), fails("invalid_response"));
  }
});

test("network timeouts and transport exceptions are bounded and sanitized", async () => {
  const timed = new PaystackBankLookupClient(
    { mode: "sandbox", secretKey },
    async (_, options) =>
      new Promise((_, reject) => {
        options!.signal!.addEventListener(
          "abort",
          () => reject(new Error(secretKey)),
          { once: true },
        );
      }),
    10,
  );
  await assert.rejects(
    timed.listNigerianBanks(),
    fails("provider_unavailable"),
  );
  const failed = new PaystackBankLookupClient(
    { mode: "sandbox", secretKey },
    async () => {
      throw new Error(`${secretKey} ${account.accountNumber}`);
    },
  );
  await assert.rejects(failed.listNigerianBanks(), (error: unknown) => {
    assert.ok(error instanceof PaystackLookupError);
    assert.ok(!error.message.includes(secretKey));
    assert.ok(!error.message.includes(account.accountNumber));
    return true;
  });
});

test("failed HTTP responses release their body and response-body stalls time out", async () => {
  let cancelled = false;
  const rejected = new PaystackBankLookupClient(
    { mode: "sandbox", secretKey },
    async () =>
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
        { status: 503 },
      ),
  );
  await assert.rejects(
    rejected.listNigerianBanks(),
    fails("provider_unavailable"),
  );
  assert.equal(cancelled, true);
  const stalled = new PaystackBankLookupClient(
    { mode: "sandbox", secretKey },
    async (_, options) =>
      new Response(
        new ReadableStream({
          start(controller) {
            options!.signal!.addEventListener(
              "abort",
              () => controller.error(new Error("fixture body stalled")),
              { once: true },
            );
          },
        }),
      ),
    10,
  );
  await assert.rejects(
    stalled.listNigerianBanks(),
    fails("provider_unavailable"),
  );
});

test("owner preflight reports only catalogue metadata and leaves ownership verification disabled", async () => {
  const result = await checkPaystackBankAccess(
    { PAYSTACK_MODE: "sandbox", PAYSTACK_SECRET_KEY: secretKey },
    async () => json({ status: true, data: [bank] }),
  );
  assert.deepEqual(result, {
    catalogueAvailable: true,
    mode: "sandbox",
    country: "NG",
    currency: "NGN",
    bankCount: 1,
    ownershipVerificationEnabled: false,
  });
  assert.ok(!JSON.stringify(result).includes(secretKey));
  assert.ok(!JSON.stringify(result).includes(bank.name));
  await assert.rejects(
    checkPaystackBankAccess({ PAYSTACK_SECRET_KEY: secretKey }, async () =>
      json({ status: true, data: [] }),
    ),
    fails("invalid_response"),
  );
});

test("staging connection diagnostics skip an unconfigured Paystack integration", async () => {
  const logs: string[] = [];
  let calls = 0;
  await reportConfiguredPaystackBankAccess(
    {},
    {
      info: (line: string) => logs.push(line),
      warn: (line: string) => logs.push(line),
    },
    async () => {
      calls++;
      throw new Error("must not request");
    },
  );
  assert.equal(calls, 0);
  assert.deepEqual(logs, []);
});

test("staging connection success logs only catalogue metadata, never names, credentials or ownership approval", async () => {
  const messages: string[] = [];
  const warnings: string[] = [];
  await reportConfiguredPaystackBankAccess(
    { PAYSTACK_MODE: "sandbox", PAYSTACK_SECRET_KEY: secretKey },
    {
      info: (line: string) => messages.push(line),
      warn: (line: string) => warnings.push(line),
    },
    async () => json({ status: true, data: [bank] }),
  );
  assert.equal(messages.length, 1);
  assert.ok(messages[0].startsWith("Paystack bank catalogue check: "));
  assert.deepEqual(JSON.parse(messages[0].slice(messages[0].indexOf("{"))), {
    catalogueAvailable: true,
    mode: "sandbox",
    country: "NG",
    currency: "NGN",
    bankCount: 1,
    ownershipVerificationEnabled: false,
  });
  assert.ok(!messages[0].includes(secretKey));
  assert.ok(!messages[0].includes(bank.name));
  assert.deepEqual(warnings, []);
});

test("staging connection failures are nonfatal and log sanitized configuration or provider categories", async () => {
  const fixtures = [
    {
      credentials: { PAYSTACK_MODE: "sandbox" },
      status: 200,
      expected: "Check PAYSTACK_MODE",
    },
    {
      credentials: { PAYSTACK_MODE: "live", PAYSTACK_SECRET_KEY: secretKey },
      status: 200,
      expected: "matching PAYSTACK_MODE",
    },
    {
      credentials: { PAYSTACK_MODE: "sandbox", PAYSTACK_SECRET_KEY: secretKey },
      status: 401,
      expected: "authentication_failed",
    },
    {
      credentials: { PAYSTACK_MODE: "sandbox", PAYSTACK_SECRET_KEY: secretKey },
      status: 503,
      expected: "provider_unavailable",
    },
  ];
  for (const fixture of fixtures) {
    const messages: string[] = [];
    const warnings: string[] = [];
    await reportConfiguredPaystackBankAccess(
      fixture.credentials,
      {
        info: (line: string) => messages.push(line),
        warn: (line: string) => warnings.push(line),
      },
      async () =>
        json(
          {
            status: false,
            message: `${secretKey} ${account.accountNumber} private-holder`,
          },
          fixture.status,
        ),
    );
    assert.deepEqual(messages, []);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes(fixture.expected));
    for (const privateValue of [
      secretKey,
      account.accountNumber,
      "private-holder",
    ])
      assert.ok(!warnings[0].includes(privateValue));
  }
});
