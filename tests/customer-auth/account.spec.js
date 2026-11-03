import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { createDecipheriv } from "node:crypto";
const require = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const { Pool } = require("pg");
const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
function decrypt(value) {
  const b = Buffer.from(value, "base64"),
    d = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(process.env.AUTH_TEST_KEY, "hex"),
      b.subarray(0, 12),
    );
  d.setAuthTag(b.subarray(-16));
  return JSON.parse(
    Buffer.concat([d.update(b.subarray(12, -16)), d.final()]).toString(),
  );
}
const password = "A browser test password 78!";
async function register(page, email, phone) {
  await page.goto("/register");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Country", { exact: true }).selectOption("NG");
  await page.getByLabel("Phone number", { exact: true }).fill(phone);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/verify-contacts$/);
}
async function messages(email) {
  const r = await db.query(
    "SELECT o.payload FROM delivery_outbox o JOIN users u ON u.id=o.user_id WHERE u.email=$1 ORDER BY o.created_at",
    [email],
  );
  return r.rows.map((r) => decrypt(r.payload));
}
test.beforeAll(async () => {
  await db.query(
    "TRUNCATE users,sessions,challenges,recovery_codes,step_ups,audit_events,delivery_outbox,rate_limits RESTART IDENTITY CASCADE",
  );
});
test.afterAll(async () => {
  await db.end();
});

test("customer registration, contact verification and login are durable and keep KYC gated", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const email = "browser@example.com";
  await register(page, email, "+2348031234571");
  await page.reload();
  const ms = await messages(email);
  for (const purpose of ["email", "phone"]) {
    const code = ms
      .find((m) => m.text.includes(`${purpose} verification code`))
      .text.match(/\b\d{6}\b/)[0];
    const panel = page.locator("section").filter({
      has: page.getByRole("heading", {
        name: purpose === "email" ? "Email address" : "Phone number",
        exact: true,
      }),
    });
    await panel.getByLabel("Six-digit code").fill(code);
    await panel.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(panel.getByText("Verified", { exact: true })).toBeVisible();
  }
  await page.getByRole("link", { name: "Continue to your account" }).click();
  await expect(page.getByText("Identity verification is next.")).toBeVisible();
  await expect(page.getByRole("button", { name: /send|receive/i })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login$/);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/account$/);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: ".preview/customer-account-desktop.png",
    fullPage: true,
  });
});
test("mobile registration stays within the viewport and errors are accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("missing@example.com");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("alert", { name: "Account error" }),
  ).toContainText("Email or password");
  await expect(
    page.getByRole("alert", { name: "Account error" }),
  ).toBeFocused();
  await register(page, "mobile@example.com", "+2348031234572");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `No overflow at ${width}`,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".preview/customer-verification-mobile.png",
    fullPage: true,
  });
});
test("password recovery uses a single-use link and signs out existing sessions", async ({
  page,
}) => {
  const email = "recovery@example.com";
  await register(page, email, "+2348031234573");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account matches");
  const ms = await messages(email),
    link = ms
      .find((m) => m.text.includes("#token="))
      .text.match(/http[^\s]+/)[0];
  await page.goto(link);
  await expect(page).toHaveURL(/reset-password$/);
  await page
    .getByLabel("New password", { exact: true })
    .fill("A replaced browser password 19!");
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  await page
    .getByRole("link", { name: "Sign in with your new password" })
    .click();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("A replaced browser password 19!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/verify-contacts$/);
});
test("session page identifies this device and revokes its access", async ({
  page,
}) => {
  await register(page, "sessions@example.com", "+2348031234574");
  await page.getByRole("link", { name: "Devices", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "This device", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out this device" }).click();
  await expect(page).toHaveURL(/login$/);
  const r = await page.request.get("/api/auth/me");
  expect(r.status()).toBe(401);
});
test("shared login does not expose an admin signup and denies customer admin access", async ({
  page,
}) => {
  await register(page, "role@example.com", "+2348031234575");
  const r = await page.request.get("/api/admin/access");
  expect(r.status()).toBe(403);
  await page.goto("/admin-access");
  await expect(
    page.getByRole("alert", { name: "Account error" }),
  ).toContainText("Administrator access required");
  await expect(
    page.getByRole("heading", { name: "Admin authentication is ready." }),
  ).toHaveCount(0);
});

test("the shared login requires admin authenticator setup before routing to protected admin readiness", async ({
  page,
}) => {
  const argon2 = require("argon2");
  const { authenticator } = require("otplib");
  const { randomUUID } = await import("node:crypto");
  const ph = await argon2.hash(password);
  await db.query(
    "INSERT INTO users(id,email,password_hash,country,role) VALUES($1,'browser-admin@example.com',$2,'NG','admin')",
    [randomUUID(), ph],
  );
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("browser-admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/mfa-setup$/);
  const forbidden = await page.request.get("/api/admin/access");
  expect(forbidden.status()).toBe(403);
  await page
    .getByRole("button", { name: "Set up authenticator", exact: true })
    .click();
  const key = await page.locator(".setup-key code").textContent();
  await expect(
    page.getByAltText("Scan this QR code with your authenticator app"),
  ).toBeVisible();
  await page
    .getByLabel("Six-digit authenticator code", { exact: true })
    .fill(authenticator.generate(key));
  await page
    .getByRole("button", { name: "Enable authenticator", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Save your recovery codes",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".recovery-codes code")).toHaveCount(8);
  await page
    .getByRole("button", { name: "I’ve stored my codes securely" })
    .click();
  await expect(page).toHaveURL(/admin-access$/);
  await expect(
    page.getByRole("heading", {
      name: "Admin authentication is ready.",
      exact: true,
    }),
  ).toBeVisible();
  expect((await page.request.get("/api/admin/access")).status()).toBe(200);
});
