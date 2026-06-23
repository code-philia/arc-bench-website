import { test, expect } from '@playwright/test';

test('REQ-5.5: Cart Summary', async ({ page }) => {
  // 1. Setup
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();
  await page.getByRole('button', { name: /add to cart/i }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByRole('link', { name: /proceed to checkout/i }).click();

  // 2. Assertion
  const summary = page.locator('.cart-summary').or(page.getByRole('complementary', { name: /summary/i }));
  await expect(summary).toBeVisible();
  await expect(summary.getByText(/subtotal/i)).toBeVisible();
  await expect(summary.getByText(/shipping/i)).toBeVisible();
  await expect(summary.getByText(/total/i)).toBeVisible();
});
