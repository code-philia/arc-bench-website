import { test, expect } from '@playwright/test';

test('REQ-3-5-2.2: View More Dates', async ({ page }) => {
  // 1. Navigation
  await page.goto('/flight/list');

  // 2. Interaction
  await page.getByRole('button', { name: /更多日期/i }).click();

  // 3. Assertion
  await expect(page.getByRole('dialog', { name: /日期选择/i })).toBeVisible();
});
