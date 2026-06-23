import { test, expect } from '@playwright/test';

test('REQ-3-2.3: Exception Same-City Validation', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByPlaceholder(/出发城市/i).fill('成都');
  await page.getByPlaceholder(/到达城市/i).fill('成都');
  await page.getByRole('button', { name: /搜索/i }).click();

  // 3. Assertion
  await expect(page.getByText(/出发城市和到达城市不能相同/i)).toBeVisible();
  await expect(page).toHaveURL(/\//); // Ensure no navigation occurred
});
