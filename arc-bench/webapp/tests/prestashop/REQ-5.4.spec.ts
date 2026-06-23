import { test, expect } from '@playwright/test';

test('REQ-5.4: Delete Product', async ({ page }) => {
  // 1. Setup
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();
  await page.getByRole('button', { name: /add to cart/i }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByRole('link', { name: /proceed to checkout/i }).click();

  // 2. Interaction
  const cartItem = page.locator('.cart-item').first();
  const deleteBtn = cartItem.getByRole('button', { name: /delete|remove/i }).or(cartItem.locator('.remove-from-cart'));
  await deleteBtn.click();

  // Wait for loading
  await page.waitForTimeout(1000);

  // 3. Assertion
  await expect(page.getByText(/there are no more items in your cart/i)).toBeVisible();
});
