import { test, expect } from '@playwright/test';

test('REQ-3.5.3: Click to Enter Detail Page', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // 2. Interaction
  const firstProduct = page.locator('article').first();
  await firstProduct.getByRole('link').first().click();

  // 3. Assertion
  await expect(page).toHaveURL(/.*[a-zA-Z0-9].*/);
  await expect(page.getByRole('button', { name: /add to cart/i })).toBeVisible();
});
