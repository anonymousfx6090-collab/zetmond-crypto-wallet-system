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
- Interactive three-step Vault explanation with keyboard navigation.
- Fee illustration using integer arithmetic for exact amounts.
- Expandable FAQs and mobile navigation.
- Get started and Log in buttons remain unlinked until the Task 2 web app is connected.
- Separate Terms, Privacy, and Vault/Fee policy routes.
- Page titles, descriptions, and a custom missing-page screen.

This website presents the Zetmond customer experience and product flow. It is
intended for marketing and product discovery, not for live account onboarding or
definitive market execution. The public pages do not accept credentials,
customer documents, or funds.

Terms and Privacy are explicitly draft placeholders. Unresolved PRD policies
remain labelled TBD. Customer and admin functionality belong to Tasks 2 and 3.

## Browser checks

```sh
pnpm build
pnpm test
```

On Windows tests use the installed Microsoft Edge if available. Elsewhere,
install Playwright Chromium with `pnpm exec playwright install chromium`.
Checks cover exact fee examples, Vault tabs, FAQs, inactive account buttons, responsive
overflow, mobile navigation, policy routes, and the missing-page screen.

No public deployment or external service connection is configured.
