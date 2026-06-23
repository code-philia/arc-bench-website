import { test, expect } from '@playwright/test';

test('REQ-6.1: Start Checkout', async ({ page }) => {
  // 1. Setup
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();
  await page.getByRole('button', { name: /add to cart/i }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByRole('link', { name: /proceed to checkout/i }).click();
  await page.getByRole('link', { name: /proceed to checkout/i }).or(page.getByRole('button', { name: /proceed to checkout/i })).click();

  // 2. Assertion
  // Should be at step 1: Personal Information
  const step1 = page.locator('#checkout-personal-information-step');
  await expect(step1).toBeVisible();
});
