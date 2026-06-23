import { test, expect } from '@playwright/test';

test('REQ-4.5.3: Direct Input Quantity', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();

  // 2. Interaction
  const qtyInput = page.getByRole('spinbutton', { name: /quantity/i }).or(page.locator('#quantity_wanted'));
  await qtyInput.fill('5');

  // 3. Assertion
  await expect(qtyInput).toHaveValue('5');
});
