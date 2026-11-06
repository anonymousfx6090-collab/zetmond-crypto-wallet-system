# Render staging deployment

This deployment is for testing account access while the remaining product and launch policies are completed. The full product remains the intended customer-launch scope. Operator details and final policies are still pending; staging does not mark them approved.

## 1. Deploy the staging-capable code

Merge the staging change into the branch your Render API service deploys (currently `main`). Keep the existing monorepo settings:

| Render setting | Value |
| --- | --- |
| Root Directory | Leave blank: repository root |
| Build Command | `corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm --filter @zetmond/api build` |
| Start Command | `node apps/api/dist/migrate.js && node apps/api/dist/main.js` |
| Health Check Path | `/api/health` |
| Node version | 24 |

Invoke pnpm through Corepack directly; `corepack enable` cannot rewrite Render's read-only system pnpm shim.

## 2. Set Render service environment variables

Update these in **Render Dashboard → API service → Environment**. The repository's private `.env` file does not need editing or uploading.

```env
NODE_ENV=production
DEPLOYMENT_STAGE=staging
APP_ORIGIN=https://zetmond.vercel.app
DELIVERY_MODE=provider
SECURITY_POLICY_APPROVED=false
TERMS_VERSION=development-draft
```

Keep the existing valid `DATABASE_URL`, stable `DATA_ENCRYPTION_KEY`, and Gmail SMTP settings. Use a Neon database/branch reserved for testing. Render supplies `PORT`; no custom value is necessary. `TERMS_URL` and `PRIVACY_URL` can remain unset while their final policies are pending; remove empty-string entries rather than supplying invalid URLs. Do not declare draft policies approved.

Hosted staging still requires HTTPS and configured email delivery. `NODE_ENV=production` controls secure cookies and the public listener; `DEPLOYMENT_STAGE=staging` selects the testing lifecycle. Production is the default stage when this setting is omitted. A typo in the stage is rejected.

Save and deploy the latest commit. A successful startup log identifies `staging` and the assigned port. `/api/health` should return:

```json
{"status":"ok","deploymentStage":"staging"}
```

## 3. Connect the customer app

In the **customer app's Vercel project**, set `API_INTERNAL_ORIGIN` to the API service's actual Render HTTPS origin, with no `/api` suffix or trailing slash. Redeploy the customer app so its server-side rewrite uses that address. This value does not belong in the marketing Vercel project.

The current customer address is `https://zetmond.vercel.app`, so it must match the API's `APP_ORIGIN`. The customer app shows a staging notice on its account screens and uses the existing test-policy page when final policy links are unset.

## 4. Verify before starting Task 3

- Render health responds with `deploymentStage=staging`.
- The customer app displays the test-environment notice and can reach the API through its `/api` proxy.
- Using test details, verify actual email delivery, email verification, login, recovery and logout. Local automated tests do not establish that Gmail delivery works from Render.
- Staging never reports financial access, even for a test account with approved KYC. Direct financial-eligibility requests are rejected; existing authentication, MFA and role checks still apply.

After this deployment is confirmed working, proceed to Task 3, KYC and bank verification. No Task 3 integration is implemented by this deployment change.

## Production transition

Use separate production data/configuration. Set `DEPLOYMENT_STAGE=production` (or remove the staging override) only for the actual launch. All original production policy, HTTPS and delivery checks then apply, including approved security policy, approved terms version and final HTTPS terms/privacy notices. Complete the full product and its release gates before real-customer financial use; switching the flag does not implement missing features.
