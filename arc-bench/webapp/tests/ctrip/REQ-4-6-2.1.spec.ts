import { test, expect } from '@playwright/test';

test('REQ-4-6-2.1: View Refund/Change Rules', async ({ page }) => {
  // 1. Navigation
  await page.goto('/order/detail/123');

  // 2. Wait for page to load then click rules button
  await page.getByRole('button', { name: /退改规则/i }).waitFor();
  await page.getByRole('button', { name: /退改规则/i }).click();

  // 3. Assertion
  await expect(page.getByText(/手续费/i).first()).toBeVisible();
});
