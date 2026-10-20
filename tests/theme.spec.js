import { test, expect } from '@playwright/test';

async function chooseTheme(page, name) {
  await page.getByRole('button', { name: /^Color theme:/ }).click();
  await page.getByRole('menuitemradio', { name, exact: true }).click();
}

test('theme selection persists while System follows live device changes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(root).toHaveAttribute('data-theme-preference', 'system');
  await chooseTheme(page, 'Dark');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('zetmond-theme'))).toBe('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.goto('/vault-policy', { waitUntil: 'domcontentloaded' });
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await chooseTheme(page, 'Light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  await chooseTheme(page, 'System');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: '.preview/theme-light-desktop.png' });
  const communityImage = page.getByAltText(/Illustrative editorial image/);
  await communityImage.scrollIntoViewIfNeeded();
  await expect.poll(() => communityImage.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: '.preview/theme-light-page.png', fullPage: true });
  await chooseTheme(page, 'Dark');
  await page.screenshot({ path: '.preview/theme-dark-desktop.png' });
  expect(errors).toEqual([]);
});

test('theme picker supports keyboard controls and mobile drawer selection', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const trigger = page.getByRole('button', { name: /^Color theme:/ });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: 'System', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'Color theme' })).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Open menu' }).click();
  const drawer = page.getByRole('dialog', { name: 'Site menu' });
  await drawer.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await drawer.getByRole('button', { name: 'System', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.setViewportSize({ width: 390, height: 844 });
  await drawer.evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: '.preview/theme-light-menu.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  await page.screenshot({ path: '.preview/theme-light-mobile.png' });
});

test('saved theme initializes before app hydration and blocked storage stays usable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => { try { localStorage.setItem('zetmond-theme', 'dark'); } catch {} });
  await page.route(/\/_next\/static\/.*\.js(?:\?|$)/, route => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.unrouteAll();
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
    Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await chooseTheme(page, 'Dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
