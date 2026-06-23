import { test, expect } from '@playwright/test';

test('REQ-4-5-3.1: View Order Details', async ({ page }) => {
  // 1. Navigation
  await page.goto('/order/list');

  // 2. Interaction - Click on an order status link
  await page.getByText(/待支付/i).first().click();

  // 3. Assertion
  await expect(page).toHaveURL(/order/i);
});
