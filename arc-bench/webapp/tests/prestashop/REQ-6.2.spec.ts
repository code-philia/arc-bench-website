import { test, expect } from '@playwright/test';

test('REQ-6.2: Personal Information Step', async ({ page }) => {
  // 1. Setup
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();
  await page.getByRole('button', { name: /add to cart/i }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByRole('link', { name: /proceed to checkout/i }).click();
  await page.getByRole('link', { name: /proceed to checkout/i }).or(page.getByRole('button', { name: /proceed to checkout/i })).click();

  // 2. Interaction (Not logged in)
  const step1 = page.locator('#checkout-personal-information-step');
  
  // 3. Assertion
  await expect(step1.getByRole('link', { name: /sign in/i }).or(step1.getByText(/sign in/i))).toBeVisible();
  await expect(step1.getByRole('textbox', { name: /first name/i })).toBeVisible(); // Guest form
});
