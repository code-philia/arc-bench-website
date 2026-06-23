import { test, expect } from '@playwright/test';

test('REQ-7-2-2.1: View Detailed Status', async ({ page }) => {
  // 1. Navigation
  await page.goto('/status/detail/JD5162');

  // 2. Wait for data to load
  await page.getByText(/值机柜台/i).first().waitFor({ timeout: 10000 });

  // 3. Assertion
  await expect(page.getByText(/值机柜台/i).first()).toBeVisible();
  await expect(page.getByText(/登机口/i).first()).toBeVisible();
});
