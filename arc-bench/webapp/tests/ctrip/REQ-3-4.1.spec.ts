import { test, expect } from '@playwright/test';

test('REQ-3-4.1: Run a Standard Search', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByPlaceholder(/出发城市/i).fill('北京');
  await page.getByPlaceholder(/到达城市/i).fill('上海');
  await page.getByRole('button', { name: /搜索/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/flight/i);
});
