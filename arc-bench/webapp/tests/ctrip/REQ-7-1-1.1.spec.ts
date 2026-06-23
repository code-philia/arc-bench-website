import { test, expect } from '@playwright/test';

test('REQ-7-1-1.1: Exact Flight Number Query', async ({ page }) => {
  // 1. Navigation
  await page.goto('/status');

  // 2. Interaction
  await page.getByRole('radio', { name: /搜航班号/i }).check();
  await page.getByPlaceholder(/航班号/i).fill('JD5162');
  await page.getByRole('button', { name: /查询|搜索/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/status\/detail/i);
});
