import { test, expect } from '@playwright/test';

test('REQ-4.6.3: Proceed to Checkout After Add', async ({ page }) => {
  // 1. Navigation & Action
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();
  await page.getByRole('button', { name: /add to cart/i }).click();

  // 2. Interaction
  const modal = page.getByRole('dialog').or(page.locator('#blockcart-modal'));
  await expect(modal).toBeVisible();
  
  // Proceed to checkout button
  await modal.getByRole('link', { name: /proceed to checkout/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/.*cart.*/i);
});
