import { test, expect } from '@playwright/test';

test('REQ-9-1-2.1: View Travel Weather', async ({ page }) => {
  // 1. Navigation
  await page.goto('/airport');

  // 2. Wait for weather data and assertion
  await page.getByText(/今日天气/i).waitFor({ timeout: 10000 });
  await expect(page.getByText(/今日天气/i)).toBeVisible();
  await expect(page.getByText(/°C/i).first()).toBeVisible();
});
