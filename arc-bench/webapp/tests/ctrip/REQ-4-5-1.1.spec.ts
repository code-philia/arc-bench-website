import { test, expect } from '@playwright/test';

test('REQ-4-5-1.1: Switch to Pending Payment', async ({ page }) => {
  // 1. Navigation
  await page.goto('/order/list');

  // 2. Interaction
  await page.getByRole('tab', { name: /待支付/i }).click();

  // 3. Assertion - Tab should be selected
  await expect(page.getByRole('tab', { name: /待支付/i })).toHaveAttribute('aria-selected', 'true');
});
