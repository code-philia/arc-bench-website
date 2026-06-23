import { test, expect } from '@playwright/test';

test('REQ-4-5-2.1: Search Historical Orders', async ({ page }) => {
  // 1. Navigation
  await page.goto('/order/list');

  // 2. Interaction
  await page.getByPlaceholder(/订单号/i).fill('123456789');
  await page.getByRole('button', { name: /搜索/i }).click();

  // 3. Assertion
  await expect(page.getByText('123456789')).toBeVisible();
});
