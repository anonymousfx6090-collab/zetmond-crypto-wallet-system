# Zetmond

Responsive custodial USDT wallet and P2P Vault platform for customers.

Task 1 is the public marketing website, built with **Next.js App Router, React,
Tailwind CSS, and pnpm**. The PRD and original logo remain in the project root.

## Run locally

Use Node.js 22 or later and pnpm 11.9.0.

```sh
pnpm install
pnpm dev
```

Open **http://localhost:4173**. Keep the terminal running the server open.

Account links open the separate customer app. To use them locally, complete the
[Task 2 database and API setup](docs/task-2-authentication.md#local-setup), then run
these commands from the repository root in three separate terminals:

| App | Command | Address |
| --- | --- | --- |
| Marketing | `pnpm dev` | `http://127.0.0.1:4173` |
| Customer | `pnpm dev:customer` | `http://127.0.0.1:4200/login` |
| API | `pnpm dev:api` | `http://127.0.0.1:4100/api/health` |

“Get started” and “Create an account” open `/register` in the customer app;
“Log in” opens `/login`. This includes the desktop header, mobile menu, hero and footer.

Account links default to `http://127.0.0.1:4200` for local use. To use another address,
create `marketing/.env.local` using [marketing/.env.example](marketing/.env.example)
and set `NEXT_PUBLIC_CUSTOMER_APP_ORIGIN` to the customer app's origin.
For VS Code forwarded ports, use the browser-visible address for port 4200 and
set the API's `APP_ORIGIN` to that same origin.

For deployment, set `NEXT_PUBLIC_CUSTOMER_APP_ORIGIN` to the deployed customer's
HTTPS origin in the build environment or `marketing/.env.local` before building.
The default loopback address is for local use. The origin is embedded in the
marketing build; rebuild after changing it.

```sh
pnpm build
pnpm start
```

The second pair of commands builds and serves the production version.

## Project structure

```text
marketing/
  app/
    layout.jsx             Shared page metadata and layout
    page.jsx               Marketing landing page
    globals.css            Tailwind theme and illustration styles
    terms/page.jsx         Draft terms
    privacy/page.jsx       Draft privacy notice
    vault-policy/page.jsx  Confirmed Vault rules and open decisions
    not-found.jsx          Missing-page screen
  components/
    SiteShell.jsx          Navigation and footer
    MarketingHome.jsx      Landing sections and interactive examples
    PolicyPage.jsx         Shared policy presentation
  public/
    zetmond-logo.png       Supplied brand asset
  next.config.mjs
  postcss.config.mjs
tests/
  marketing.spec.js        Browser checks
```

## Included

- Responsive marketing page with the supplied purple brand.
- Wallet dashboard hero with balance visibility controls and activity/trade views.
- Light, Dark, and System appearance modes, remembered locally across visits.
- Interactive three-step Vault explanation with keyboard navigation.
- Expandable FAQs and mobile navigation.
- Account links connect to the customer app's registration and login screens.
- Separate Terms, Privacy, and Vault/Fee policy routes.
- Page titles, descriptions, and a custom missing-page screen.

This website presents the Zetmond customer experience and product flow. It is
intended for marketing and product discovery, not for live account onboarding or
definitive market execution. The public pages do not accept credentials,
customer documents, or funds.

Terms and Privacy are explicitly draft placeholders. Unresolved PRD policies
remain labelled TBD. Customer authentication is Task 2; KYC/bank verification is
Task 3, and the admin portal remains Task 10.

## Browser checks

```sh
pnpm build
pnpm test
```

On Windows tests use the installed Microsoft Edge if available. Elsewhere,
install Playwright Chromium with `pnpm exec playwright install chromium`.
Checks cover hero wallet controls, Vault tabs, FAQs, account link destinations, responsive
overflow, mobile navigation, policy routes, and the missing-page screen.
Theme checks cover saved preferences, live system changes, keyboard/mobile controls,
initial rendering, and browsers with storage disabled.

No public deployment or external service connection is configured.

## Customer accounts and authentication (Task 2)

The marketing site remains in `marketing/`. The customer application is in `apps/customer/` and the NestJS/PostgreSQL backend is in `apps/api/`. See [Task 2 setup, structure, security policy and tests](docs/task-2-authentication.md). Authentication is implemented independently of the deferred wallet, KYC and admin operations features.
