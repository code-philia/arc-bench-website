import { test, expect } from '@playwright/test';

test('REQ-9-1-1.1: Browse Popular Airports', async ({ page }) => {
  // 1. Navigation
  await page.goto('/airport');

  // 2. Wait for data and assertion
  await page.getByText(/热门机场/i).waitFor({ timeout: 10000 });
  await expect(page.getByText(/热门机场/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /首都/i }).first()).toBeVisible();
});
