import { test, expect } from '@playwright/test';

test('REQ-5.3: Modify Product Quantity', async ({ page }) => {
  // 1. Setup
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();
  await page.getByRole('button', { name: /add to cart/i }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByRole('link', { name: /proceed to checkout/i }).click();

  // 2. Interaction
  const cartItem = page.locator('.cart-item').first();
  const qtyInput = cartItem.getByRole('spinbutton', { name: /quantity/i }).or(cartItem.locator('input[name="product-quantity-spin"]'));
  const initialQty = await qtyInput.inputValue();
  
  const upButton = cartItem.getByRole('button', { name: /increase/i }).or(cartItem.locator('.js-increase-product-quantity'));
  await upButton.click();

  // Wait for loading overlay to disappear
  await page.waitForTimeout(1000); 

  // 3. Assertion
  await expect(qtyInput).toHaveValue(String(parseInt(initialQty) + 1));
});
