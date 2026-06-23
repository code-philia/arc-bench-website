import { test, expect } from '@playwright/test';

test('REQ-1.1: View Global Navigation', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Assertion
  const nav = page.getByRole('banner'); // Header area
  await expect(nav.getByRole('link', { name: /logo/i })).toBeVisible();
  await expect(nav.getByRole('navigation')).toBeVisible(); // Category menu
  await expect(nav.getByRole('searchbox')).toBeVisible();
  await expect(nav.getByRole('combobox', { name: /language/i }).or(nav.getByRole('button', { name: /language/i }))).toBeVisible();
  await expect(nav.getByRole('link', { name: /sign in|user/i })).toBeVisible();
  await expect(nav.getByRole('link', { name: /cart/i })).toBeVisible();
});
