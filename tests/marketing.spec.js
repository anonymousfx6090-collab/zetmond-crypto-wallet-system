import { test, expect } from '@playwright/test';

test('hero wallet controls work across desktop and mobile layouts', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const wallet = page.getByRole('figure', { name: 'Zetmond wallet interface illustration' });
  await expect(wallet).toBeVisible();
  await wallet.getByRole('button', { name: 'Hide wallet balances' }).click();
  await expect(wallet).not.toContainText('220.00 USDT');
  await wallet.getByRole('button', { name: 'Show wallet balances' }).click();
  await expect(wallet).toContainText('220.00 USDT');
  await wallet.getByRole('button', { name: 'Trades', exact: true }).click();
  await expect(wallet.getByRole('region', { name: 'Trades', exact: true })).toContainText('Funding in progress');
  await wallet.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(wallet.getByRole('region', { name: 'Activity', exact: true })).toContainText('USDT received');
  await page.screenshot({ path: '.preview/hero-wallet-desktop.png' });
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No overflow at ${width}px`).toBe(true);
    await wallet.getByRole('button', { name: 'Trades', exact: true }).click();
    await expect(wallet.getByRole('region', { name: 'Trades', exact: true })).toBeVisible();
    await wallet.getByRole('button', { name: 'Activity', exact: true }).click();
    if (width === 390) {
      await page.setViewportSize({ width, height: 1700 });
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
      await page.screenshot({ path: '.preview/hero-wallet-mobile.png' });
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await wallet.locator('.hero-wallet-surface').evaluate(element => parseFloat(getComputedStyle(element).animationDuration))).toBeLessThan(0.01);
  expect(errors).toEqual([]);
});

test('Vault walkthrough supports mouse and keyboard navigation', async ({ page }) => {
  await page.goto('/#how-it-works');
  const first = page.getByRole('tab', { name: /Agree on the trade/ });
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Fund your side/ })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('Either side can make the first move.');
  await page.getByRole('tab', { name: /Follow settlement/ }).click();
  await expect(page.getByRole('tabpanel')).toContainText('The trade is complete only when both succeed.');
  await page.keyboard.press('Home');
  await expect(first).toHaveAttribute('aria-selected', 'true');
});

test('product FAQ works and account actions stay unlinked until the web app is connected', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Do both sides have to fund a trade?', { exact: true }).click();
  await expect(page.locator('details[open]')).toContainText('Either party can fund first');
  await expect(page.locator('body')).not.toContainText(/prototype|simulation|simulated|marketing preview|TBD|we’re building/i);
  for (const button of await page.getByRole('button', { name: /Get started|Log in|Create an account/, includeHidden: true }).all()) {
    await expect(button).toBeDisabled();
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('narrow layouts stay within the viewport and mobile navigation works', async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your USDT.');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `Page overflows at ${width}px`).toBe(false);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu' }).click();
  const menu = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(menu).toBeVisible();
  const dialog = page.getByRole('dialog', { name: 'Site menu' });
  await expect(dialog.getByRole('button', { name: 'Close menu' })).toBeFocused();
  await expect(page.locator('.site-page')).toHaveAttribute('inert', '');
  await expect.poll(() => page.locator('.site-page').evaluate(element => Math.round(element.getBoundingClientRect().left))).toBe(-195);
  expect((await dialog.boundingBox()).height).toBe(844);
  await dialog.getByRole('button', { name: 'System', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('link', { name: 'Zetmond home' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'System', exact: true })).toBeFocused();
  await page.screenshot({ path: '.preview/mobile-menu-open.png' });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
  await expect(page.locator('.site-page')).not.toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('.mobile-menu-backdrop').click({ position: { x: 15, y: 150 } });
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await menu.getByRole('link', { name: /Wallet/ }).click();
  await expect(menu).not.toBeVisible();
  await expect(page).toHaveURL(/#wallet$/);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  await page.screenshot({ path: '.preview/mobile-product.png', fullPage: true });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await page.screenshot({ path: '.preview/desktop-product.png', fullPage: true });
});

test('policy routes load directly with accurate labels and return links', async ({ page }) => {
  for (const [route, title] of [['/terms', 'Terms of service'], ['/privacy', 'Privacy notice'], ['/vault-policy', 'The Vault, explained.']]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    if (route !== '/vault-policy') await expect(page.getByText(/Draft placeholder for review/)).toBeVisible();
    await page.getByRole('link', { name: 'Back to Zetmond', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your USDT.');
  }
  await page.goto('/missing-page');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page isn’t here.');
});
