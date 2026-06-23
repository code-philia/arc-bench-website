import { test, expect } from '@playwright/test';

test('REQ-5.7: Proceed to Checkout Button', async ({ page }) => {
  // 1. Setup
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();
  await page.getByRole('button', { name: /add to cart/i }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByRole('link', { name: /proceed to checkout/i }).click();

  // 2. Interaction
  const checkoutBtn = page.getByRole('link', { name: /proceed to checkout/i }).or(page.getByRole('button', { name: /proceed to checkout/i }));
  await checkoutBtn.click();

  // 3. Assertion
  await expect(page).toHaveURL(/.*order.*/i);
});
