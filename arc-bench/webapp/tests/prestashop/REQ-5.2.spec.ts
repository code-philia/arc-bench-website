import { test, expect } from '@playwright/test';

test('REQ-5.2: Cart Product List', async ({ page }) => {
  // 1. Setup
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();
  await page.getByRole('button', { name: /add to cart/i }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByRole('link', { name: /proceed to checkout/i }).click();

  // 2. Assertion
  const cartItem = page.locator('.cart-item').first();
  await expect(cartItem).toBeVisible();
  await expect(cartItem.getByRole('img')).toBeVisible();
  await expect(cartItem.getByRole('link').first()).toBeVisible(); // Name
  await expect(cartItem.locator('.product-price').or(page.getByText(/\$\d+/).first())).toBeVisible();
  await expect(cartItem.getByRole('spinbutton', { name: /quantity/i }).or(cartItem.locator('input[name="product-quantity-spin"]'))).toBeVisible();
  await expect(cartItem.getByRole('button', { name: /delete/i }).or(cartItem.locator('.remove-from-cart'))).toBeVisible();
});
