import { test, expect } from '@playwright/test';

test('REQ-3-2-1.2: Find Cities by Pinyin Group', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction - Click the destination city input to open city selector
  await page.getByPlaceholder(/到达城市/i).click();

  // Wait for city selector and click the GHIJ tab
  await expect(page.getByRole('tab', { name: /GHIJ/i })).toBeVisible({ timeout: 10000 });
  await page.getByRole('tab', { name: /GHIJ/i }).click();
  await page.getByText('广州').first().click();

  // 3. Assertion
  await expect(page.getByPlaceholder(/到达城市/i)).toHaveValue(/广州/i);
});
