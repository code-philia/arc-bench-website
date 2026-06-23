import { test, expect } from '@playwright/test';

test('REQ-4.2: Detailed settings', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('button', { name: /settings/i }).click();
  await page.getByRole('menuitem', { name: /settings/i, exact: true }).or(page.getByText(/settings/i).nth(1)).click();

  // 3. Assertion
  await expect(page.getByRole('heading', { name: /settings/i, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
});
