import { test, expect } from '@playwright/test';

test('REQ-2.3.3: Trash list', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('button', { name: /trash/i }).click();

  // 3. Assertion
  await expect(page.getByRole('heading', { name: /trash/i })).toBeVisible();
});
