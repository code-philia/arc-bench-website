import { test, expect } from '@playwright/test';

test('REQ-3-2-1.1: Select a Hot City', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction - Click the departure city input to open city selector
  await page.getByPlaceholder(/出发城市/i).click();

  // 3. Assertion & Further Interaction - Wait for city selector to appear
  await expect(page.getByRole('tab', { name: /热门/i })).toBeVisible({ timeout: 10000 });
  await page.getByText('成都').first().click();

  // 4. Final Assertion
  await expect(page.getByPlaceholder(/出发城市/i)).toHaveValue(/成都/i);
});
