import { test, expect } from '@playwright/test';

test('REQ-9-1-1.2: Find via Alphabet Index', async ({ page }) => {
  // 1. Navigation
  await page.goto('/airport');

  // 2. Wait for data and interaction
  await page.getByRole('tab', { name: /国内机场/i }).waitFor({ timeout: 10000 });
  await page.getByRole('tab', { name: /国内机场/i }).click();
  await page.getByRole('button', { name: 'C' }).click();

  // 3. Assertion
  await expect(page.getByRole('link', { name: /成都/i }).first()).toBeVisible({ timeout: 10000 });
});
