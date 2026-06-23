import { test, expect } from '@playwright/test';

test('REQ-4-6-1.1: Pending Payment Countdown', async ({ page }) => {
  // 1. Navigation
  await page.goto('/order/detail/123');

  // 2. Assertion
  await expect(page.getByText(/建议在.*内完成支付/i)).toBeVisible();
});
