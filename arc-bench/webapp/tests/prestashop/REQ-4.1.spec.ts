import { test, expect } from '@playwright/test';

test('REQ-4.1: Enter Product Detail Page', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // 2. Interaction
  const firstProduct = page.locator('article').first();
  await firstProduct.getByRole('link').first().click();

  // 3. Assertion
  await expect(page.getByRole('button', { name: /add to cart/i })).toBeVisible();
  await expect(page.locator('.product-prices')).toBeVisible();
});
