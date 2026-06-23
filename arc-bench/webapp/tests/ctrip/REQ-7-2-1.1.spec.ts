import { test, expect } from '@playwright/test';

test('REQ-7-2-1.1: View Flight Status in List', async ({ page }) => {
  // 1. Navigation
  await page.goto('/status/list');

  // 2. Wait for data to load
  await page.getByRole('list').waitFor({ timeout: 10000 });

  // 3. Assertion
  await expect(page.getByRole('list')).toBeVisible();
  await expect(page.getByText(/计划起飞|航班到达/i).first()).toBeVisible();
});
