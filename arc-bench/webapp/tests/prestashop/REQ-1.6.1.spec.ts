import { test, expect } from '@playwright/test';

test('REQ-1.6.1: View Cart Count', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Assertion
  const cartIcon = page.getByRole('banner').getByRole('link', { name: /cart/i });
  await expect(cartIcon).toBeVisible();
  // Ensure some text representing count is visible within the cart area
  await expect(cartIcon.locator('.cart-products-count').or(page.getByText(/\d+/))).toBeVisible();
});
