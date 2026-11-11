import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const { Pool } = require("pg");
const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
let index = 0;
test.beforeEach(async ({ page }) => {
  const email = `verification-browser-${++index}@example.test`;
  const response = await page.request.post("/api/auth/register", {
    headers: { Origin: "http://127.0.0.1:4200", "X-Zetmond-Request": "1" },
    data: {
      email,
      phone: `+23480312345${String(index).padStart(2, "0")}`,
      country: "NG",
      password: "Browser verification password!",
      acceptTerms: true,
      policyVersion: "development-draft",
    },
  });
  expect(response.status()).toBe(201);
  // Only the isolated browser-test DB; no customer-facing verification bypass.
  await db.query("UPDATE users SET email_verified=true WHERE email=$1", [
    email,
  ]);
});
test.beforeAll(async () => {
  await db.query(
    "TRUNCATE users,sessions,challenges,recovery_codes,step_ups,audit_events,delivery_outbox,rate_limits,verification_jobs,verification_events RESTART IDENTITY CASCADE",
  );
});
test.afterAll(() => db.end());
test("real unavailable-provider screens preserve gates and fit mobile and desktop", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const screen of ["identity", "banks"]) {
      await page.goto("/" + screen);
      await expect(
        page.getByRole("heading", {
          name:
            screen === "identity"
              ? "Your identity, verified"
              : "Your bank accounts",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByRole("note")).toContainText("not available");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByRole("button", { name: "Start verification", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByLabel("Account number", { exact: true }),
      ).toHaveCount(0);
    }
  }
  await page.getByRole("button", { name: "Light appearance" }).click();
  await page.screenshot({
    path: ".preview/task3-banks-desktop.png",
    fullPage: true,
  });
  await page.goto("/identity");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dark appearance" }).click();
  await page.screenshot({
    path: ".preview/task3-identity-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
const identity = {
  status: "not_started",
  country: "NG",
  mode: "sandbox",
  available: true,
  emailVerified: true,
  canStart: true,
  canResubmit: false,
  canRefresh: false,
  disclosure: { version: "fixture-v1", url: "https://example.test/disclosure" },
};
test("identity UI starts with disclosure and recovers status after reload and correction", async ({
  page,
}) => {
  // UI contract fixture only; authenticated provider outcomes are covered by API tests.
  let state = { ...identity };
  await page.route("**/api/identity", (route) =>
    route.fulfill({ json: state }),
  );
  await page.route("**/api/identity/sessions", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      disclosureVersion: "fixture-v1",
    });
    state = {
      ...identity,
      status: "under_review",
      canStart: false,
      canRefresh: true,
    };
    await route.fulfill({ json: state });
  });
  await page.goto("/identity");
  await expect(
    page.getByRole("button", { name: "Start verification", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Start verification", exact: true })
    .click();
  await expect(
    page.getByText("Your details are being reviewed.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Your details are being reviewed.", { exact: false }),
  ).toBeVisible();
  state = {
    ...state,
    status: "correction_required",
    canResubmit: true,
    reason: "Your document was not readable. Please capture it again.",
  };
  await page.reload();
  await expect(page.getByText(state.reason)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Correct my verification" }),
  ).toBeDisabled();
  state = { ...state, status: "approved", canResubmit: false };
  await page.reload();
  await expect(
    page.getByText("These are test verification results.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View bank accounts" }),
  ).toHaveAttribute("href", "/banks");
});
test("bank form authorizes exact details and shows only masked persisted results", async ({
  page,
}) => {
  let state = {
    country: "NG",
    currency: "NGN",
    mode: "sandbox",
    available: true,
    identityVerified: true,
    mfaEnabled: true,
    emailVerified: true,
    canAdd: true,
    destinations: [],
    banks: [{ code: "fixture", name: "Fixture Bank" }],
    field: {
      label: "Account number",
      pattern: "[0-9]{10}",
      minLength: 10,
      maxLength: 10,
      inputMode: "numeric",
    },
  };
  let input, digest;
  await page.route("**/api/auth/step-up", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.purpose).toBe("bank_add");
    digest = body.operationDigest;
    await route.fulfill({
      json: { stepUpId: "00000000-0000-4000-8000-000000000001" },
    });
  });
  await page.route("**/api/banks", async (route) => {
    if (route.request().method() === "POST") {
      input = route.request().postDataJSON();
      state = {
        ...state,
        destinations: [
          {
            id: input.operationId,
            bankName: "Fixture Bank",
            maskedAccount: "•••• 7890",
            currency: "NGN",
            status: "pending",
          },
        ],
      };
      await route.fulfill({
        json: { id: input.operationId, status: "pending" },
      });
    } else await route.fulfill({ json: state });
  });
  await page.goto("/banks");
  await page.getByLabel("Bank", { exact: true }).selectOption("fixture");
  await page.getByLabel("Account number", { exact: true }).fill("1234567890");
  await page.getByLabel("Authenticator or recovery code").fill("123456");
  await page.getByRole("button", { name: "Add and verify account" }).click();
  await expect(page.getByText("•••• 7890 · NGN")).toBeVisible();
  const { createHash } = await import("node:crypto");
  expect(digest).toBe(
    createHash("sha256")
      .update(
        JSON.stringify([
          "bank_add",
          input.operationId,
          "NG",
          "fixture",
          "1234567890",
        ]),
      )
      .digest("hex"),
  );
  await expect(page.getByLabel("Account number", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Authenticator or recovery code")).toHaveValue(
    "",
  );
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain("1234567890");
});
test("bank review states explain held ownership and do not offer retries under an outdated policy", async ({
  page,
}) => {
  const destinationId = "631d1fb8-d8eb-4c44-b1b5-849276648a20";
  let checks = 0;
  const state = {
    country: "NG",
    currency: "NGN",
    mode: "sandbox",
    available: true,
    identityVerified: true,
    mfaEnabled: true,
    emailVerified: true,
    canAdd: false,
    banks: [],
    destinations: [
      {
        id: destinationId,
        bankName: "Fixture Bank",
        maskedAccount: "•••• 7890",
        currency: "NGN",
        status: "under_review",
        usable: false,
        needsReverification: false,
        reason:
          "The bank account holder details need further review against your verified identity.",
      },
    ],
  };
  await page.route("**/api/banks", (route) => route.fulfill({ json: state }));
  await page.route("**/api/banks/*/verifications", async (route) => {
    checks++;
    expect(route.request().postDataJSON()).toEqual({});
    await route.fulfill({
      json: { id: destinationId, status: "under_review" },
    });
  });
  await page.goto("/banks");
  await expect(
    page.getByRole("status", { name: "Bank ownership status" }),
  ).toHaveText("Ownership needs review");
  await expect(page.getByText(state.destinations[0].reason)).toBeVisible();
  await page.getByRole("button", { name: "Check status", exact: true }).click();
  expect(checks).toBe(1);
  state.destinations[0].needsReverification = true;
  state.destinations[0].reason =
    "This bank destination needs verification under the current policy before it can be used.";
  await page.reload();
  await expect(
    page.getByText(
      "This destination needs a new verification before it can be used.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check status", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Ownership verified", { exact: true }),
  ).toHaveCount(0);
});
test("verification API errors are accessible and revoked sessions return to login", async ({
  page,
}) => {
  await page.route("**/api/identity", (route) =>
    route.fulfill({
      status: 503,
      json: {
        message: "Verification temporarily unavailable. Please try again.",
      },
    }),
  );
  await page.goto("/identity");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Verification temporarily unavailable" }),
  ).toContainText("Verification temporarily unavailable");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Verification temporarily unavailable" }),
  ).toBeFocused();
  await page.unroute("**/api/identity");
  await db.query(
    "UPDATE sessions SET revoked_at=now() WHERE revoked_at IS NULL",
  );
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});
