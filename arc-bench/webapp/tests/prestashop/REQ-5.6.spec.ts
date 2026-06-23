import { test, expect } from '@playwright/test';

test('REQ-5.6: Continue Shopping Link', async ({ page }) => {
  // 1. Setup
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();
  await page.getByRole('button', { name: /add to cart/i }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByRole('link', { name: /proceed to checkout/i }).click();

  // 2. Interaction
  const continueShopping = page.getByRole('link', { name: /continue shopping/i });
  await continueShopping.click();

  // 3. Assertion
  await expect(page).not.toHaveURL(/.*cart.*/i);
});
