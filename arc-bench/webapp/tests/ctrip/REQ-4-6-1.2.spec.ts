import { test, expect } from '@playwright/test';

test('REQ-4-6-1.2: Cancel a Pending Payment Order', async ({ page }) => {
  // 1. Navigation
  await page.goto('/order/detail/123');

  // 2. Wait for page to load
  await page.getByRole('button', { name: /取消订单/i }).waitFor();

  // 3. Interaction
  await page.getByRole('button', { name: /取消订单/i }).click();
  await page.getByRole('button', { name: /确定|确认/i }).click();

  // 4. Assertion
  await expect(page.getByText(/已取消|已关闭/i).first()).toBeVisible();
});
