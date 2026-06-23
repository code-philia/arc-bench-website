import { test, expect } from '@playwright/test';

test('REQ-4-5-1.4: Switch to All Orders', async ({ page }) => {
  // 1. Navigation
  await page.goto('/order/list');

  // 2. Interaction
  await page.getByRole('tab', { name: /全部订单/i }).click();

  // 3. Assertion
  await expect(page.getByRole('tab', { name: /全部订单/i })).toHaveAttribute('aria-selected', 'true');
});
