import { test, expect } from '@playwright/test';

test('REQ-4.6.1: Add Product to Cart', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();

  // 2. Interaction
  const addToCartBtn = page.getByRole('button', { name: /add to cart/i });
  await addToCartBtn.click();

  // 3. Assertion
  const modal = page.getByRole('dialog').or(page.locator('#blockcart-modal'));
  await expect(modal).toBeVisible();
  await expect(modal.getByText(/successfully added/i)).toBeVisible();
});
