import { test, expect } from '@playwright/test';

test('REQ-3-2.1: Trip Type Selection', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction & Assertion for Return Trip
  await page.getByLabel(/往返/i).check();
  await expect(page.getByPlaceholder(/返回日期/i)).toBeVisible();

  // 3. Interaction & Assertion for One-way
  await page.getByLabel(/单程/i).check();
  await expect(page.getByPlaceholder(/返回日期/i)).toBeHidden();
});
