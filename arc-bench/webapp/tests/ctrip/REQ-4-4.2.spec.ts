import { test, expect } from '@playwright/test';

test('REQ-4-4.2: Select Payment Method', async ({ page }) => {
  // 1. Navigation
  await page.goto('/payment?orderId=1');

  // 2. Interaction - Click payment method option
  await page.getByText(/支付宝|使用新卡支付/i).first().click();

  // 3. Assertion - Payment method section should be visible
  await expect(page.getByText(/使用新卡支付/i).first()).toBeVisible();
});
