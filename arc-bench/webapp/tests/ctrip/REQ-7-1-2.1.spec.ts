import { test, expect } from '@playwright/test';

test('REQ-7-1-2.1: Route Range Query', async ({ page }) => {
  // 1. Navigation
  await page.goto('/status');

  // 2. Interaction
  await page.getByRole('radio', { name: /搜起降地/i }).check();
  await page.getByPlaceholder(/出发地/i).fill('上海');
  await page.getByPlaceholder(/到达地/i).fill('北京');
  await page.getByRole('button', { name: /查询|搜索/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/status\/list/i);
});
