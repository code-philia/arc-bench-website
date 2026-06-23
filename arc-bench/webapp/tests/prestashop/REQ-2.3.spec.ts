import { test, expect } from '@playwright/test';

test('REQ-2.3: Popular Products Section', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  const popularSection = page.getByRole('region', { name: /popular products/i }).or(page.locator('.featured-products'));
  const firstProduct = popularSection.locator('article').first().getByRole('link').first();
  
  await firstProduct.click();

  // 3. Assertion
  // Navigate to product detail page
  await expect(page).toHaveURL(/.*[a-zA-Z0-9].*/);
  await expect(page.getByRole('button', { name: /add to cart/i })).toBeVisible();
});
