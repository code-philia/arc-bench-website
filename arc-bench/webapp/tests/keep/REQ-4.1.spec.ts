import { test, expect } from '@playwright/test';

test('REQ-4.1: Setting options list', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('button', { name: /settings/i }).click();

  // 3. Assertion
  await expect(page.getByRole('menu').or(page.getByRole('listbox'))).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /settings/i, exact: true }).or(page.getByText(/settings/i).nth(1))).toBeVisible();
});
