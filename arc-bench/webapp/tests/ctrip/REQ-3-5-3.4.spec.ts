import { test, expect } from '@playwright/test';

test('REQ-3-5-3.4: Sort by Departure Time', async ({ page }) => {
  // 1. Navigation
  await page.goto('/flight/list');

  // 2. Interaction
  await page.getByRole('button', { name: /起飞时间早-晚/i }).click();

  // 3. Assertion
  await expect(page.getByRole('list')).toBeVisible();
});
