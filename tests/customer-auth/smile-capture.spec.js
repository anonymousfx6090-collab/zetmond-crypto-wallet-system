import { test, expect } from "@playwright/test";

// Browser contract fixtures exercise our integration, not Smile ID's camera or service.
const attemptId = "79d95e70-bf87-4e4d-a6a5-4e9c0f69a373";
const providerUser = "zetmond_31058361-ea13-4dbc-ad11-151669782dd2";
const jobId = "job_00000000000000000000000001";
const capturePath = `/identity/capture?attempt=${attemptId}`;
const sdkUrl = "https://cdn.usesmileid.com/inline/v12/js/script.min.js";
const session = {
  attemptId,
  token: "fixture.opaque.signature",
  product: "doc_verification",
  environment: "sandbox",
  callback_url: "https://api.example.test/api/webhooks/smile-id",
  partner_details: {
    partner_id: "123",
    name: "Zetmond",
    logo_url: "https://app.example.test/zetmond-logo.png",
    policy_url: "https://app.example.test/policies",
    theme_color: "#9e7cff",
  },
  partner_params: { zetmond_operation_id: attemptId, user_id: providerUser },
};
const ready = {
  attemptId,
  status: "incomplete",
  available: true,
  emailVerified: true,
  restricted: false,
  mode: "sandbox",
};
async function fixtures(page, view = ready) {
  const calls = { mint: 0, submit: [], scripts: 0 };
  await page.route("**/api/identity", (route) => route.fulfill({ json: view }));
  await page.route("**/api/identity/capture", async (route) => {
    calls.mint++;
    expect(route.request().postDataJSON()).toEqual({ attemptId });
    expect(route.request().headers()["x-zetmond-request"]).toBe("1");
    await route.fulfill({ status: 201, json: session });
  });
  await page.route("**/api/identity/capture/submission", async (route) => {
    calls.submit.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      json: { ...ready, status: "under_review" },
    });
  });
  await page.route(sdkUrl, async (route) => {
    calls.scripts++;
    await route.fulfill({
      contentType: "application/javascript",
      body: "window.fixtureFlows=[];window.SmileIdentity=function(config){window.fixtureFlows.push(config);};",
    });
  });
  return calls;
}
const openButton = (page) =>
  page.getByRole("button", { name: "Open secure verification" });
async function open(page, count = 1) {
  await openButton(page).click();
  await expect
    .poll(() => page.evaluate(() => window.fixtureFlows?.length || 0))
    .toBe(count);
}
async function result(page, value, index = 0) {
  await page.evaluate(
    ({ value, index }) => window.fixtureFlows[index].onResult(value),
    { value, index },
  );
}

test("accepted submissions stay pending and duplicate browser callbacks are ignored", async ({
  page,
}) => {
  const calls = await fixtures(page);
  await page.goto(capturePath);
  await open(page);
  const accepted = {
    status: "success",
    product: "doc_verification",
    value: {
      job_id: jobId,
      user_id: providerUser,
      status: "accepted",
    },
  };
  await result(page, accepted);
  await result(page, accepted);
  await expect(page.getByRole("status")).toContainText("submitted");
  expect(calls.submit).toEqual([{ attemptId, jobId, userId: providerUser }]);
  await expect(openButton(page)).toHaveCount(0);
  expect(
    await page.evaluate(() => JSON.stringify([localStorage, sessionStorage])),
  ).not.toContain(session.token);
  expect(await page.locator("body").innerText()).not.toContain(
    "Identity verified",
  );
  expect(calls.mint).toBe(1);
});

test("closing a flow permits a manual retry while callbacks from the previous flow are ignored", async ({
  page,
}) => {
  const calls = await fixtures(page);
  await page.goto(capturePath);
  await open(page);
  await result(page, { status: "cancelled" });
  await expect(page.getByRole("status")).toContainText("closed");
  await open(page, 2);
  await result(
    page,
    {
      status: "success",
      product: "doc_verification",
      value: { job_id: jobId, user_id: providerUser },
    },
    0,
  );
  expect(calls.submit).toHaveLength(0);
  await result(page, { status: "cancelled", product: "doc_verification" }, 1);
  await expect(openButton(page)).toBeEnabled();
  expect(calls.scripts).toBe(1);
  expect(calls.mint).toBe(2);
});

test("uncertain submission records only a hint and does not display vendor errors or offer another submission", async ({
  page,
}) => {
  const calls = await fixtures(page);
  await page.goto(capturePath);
  await open(page);
  await result(page, {
    status: "failure",
    product: "doc_verification",
    error: {
      error_code: "SUBMISSION_FAILED",
      message: "private vendor diagnostic",
      retryable: true,
    },
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Check your saved status",
  );
  await expect(page.getByRole("main").getByRole("alert")).toBeFocused();
  expect(calls.submit).toEqual([{ attemptId }]);
  await expect(openButton(page)).toHaveCount(0);
  await expect(page.getByText("private vendor diagnostic")).toHaveCount(0);
});

test("consent refusal does not retry and mismatched submission identifiers cannot be forwarded", async ({
  page,
}) => {
  const calls = await fixtures(page);
  await page.goto(capturePath);
  await open(page);
  await result(page, {
    status: "failure",
    product: "doc_verification",
    error: {
      error_code: "CONSENT_DENIED",
      retryable: true,
    },
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "declined consent",
  );
  await expect(openButton(page)).toHaveCount(0);
  expect(calls.submit).toHaveLength(0);
  await page.reload();
  await open(page);
  await result(page, {
    status: "success",
    product: "doc_verification",
    value: {
      job_id: jobId,
      user_id: "another-user",
      status: "clear",
    },
  });
  expect(calls.submit).toEqual([{ attemptId }]);
  await expect(page.getByRole("status")).toContainText("checking the result");
});

test("stale, unverified and restricted capture links cannot load the SDK or mint tokens", async ({
  page,
}) => {
  const calls = await fixtures(page);
  for (const change of [
    { attemptId: "old-attempt" },
    { emailVerified: false },
    { restricted: true },
    { status: "approved" },
  ]) {
    await page.route("**/api/identity", (route) =>
      route.fulfill({ json: { ...ready, ...change } }),
    );
    await page.goto(capturePath);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "no longer ready",
    );
    await expect(openButton(page)).toHaveCount(0);
    await page.unroute("**/api/identity");
  }
  expect(calls.mint).toBe(0);
  expect(calls.scripts).toBe(0);
});

test("expired login redirects to the shared login page", async ({ page }) => {
  await fixtures(page);
  await page.route("**/api/identity", (route) =>
    route.fulfill({ status: 401, json: { message: "Sign in again." } }),
  );
  await page.goto(capturePath);
  await expect(page).toHaveURL(/\/login$/);
});

test("capture page fits phone and desktop in both appearances and a failed script can be retried before issuance", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const calls = await fixtures(page);
  await page.goto(capturePath);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const appearance of ["Light", "Dark"]) {
      await page
        .getByRole("button", { name: `${appearance} appearance` })
        .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(openButton(page)).toBeVisible();
    }
  }
  await page.route(sdkUrl, (route) => route.abort(), { times: 1 });
  await openButton(page).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not start",
  );
  expect(calls.mint).toBe(0);
  await open(page);
  expect(calls.mint).toBe(1);
  await result(page, { status: "cancelled" });
  await page.screenshot({
    path: ".preview/smile-capture-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".preview/smile-capture-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
