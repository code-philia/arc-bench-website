import { test, expect } from '@playwright/test';

test('REQ-3-4.2: Quickly Reuse Search History', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. First do a search to create history
  await page.getByRole('button', { name: /搜索/i }).click();
  await page.waitForURL(/flight/i, { timeout: 10000 }).catch(() => {});

  // Go back to homepage
  await page.goto('/');

  // 2. Interaction - Wait for search history to load
  await page.getByText(/搜索历史/i).waitFor({ timeout: 10000 }).catch(() => {});

  // Click the first matching history item
  const historyButton = page.getByRole('button', { name: /成都.*广州|广州.*成都/i }).first();
  await historyButton.waitFor({ timeout: 10000 }).catch(() => {});
  await historyButton.click();

  // 3. Assertion
  await expect(page).toHaveURL(/flight/i);
});
