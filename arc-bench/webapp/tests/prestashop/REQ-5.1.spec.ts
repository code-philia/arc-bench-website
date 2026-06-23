import { test, expect } from '@playwright/test';

test('REQ-5.1: Enter Cart', async ({ page }) => {
  // 1. Navigation & Setup
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();
  await page.getByRole('button', { name: /add to cart/i }).click();
  
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: /continue shopping/i }).click();

  // 2. Interaction
  await page.getByRole('banner').getByRole('link', { name: /cart/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/.*cart.*/i);
  await expect(page.getByRole('heading', { name: /shopping cart/i })).toBeVisible();
});
