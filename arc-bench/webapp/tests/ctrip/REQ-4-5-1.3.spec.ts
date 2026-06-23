import { test, expect } from '@playwright/test';

test('REQ-4-5-1.3: Switch to Pending Review', async ({ page }) => {
  // 1. Navigation
  await page.goto('/order/list');

  // 2. Interaction
  await page.getByRole('tab', { name: /待点评/i }).click();

  // 3. Assertion
  await expect(page.getByRole('tab', { name: /待点评/i })).toHaveAttribute('aria-selected', 'true');
});
