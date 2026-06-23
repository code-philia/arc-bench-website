import { test, expect } from '@playwright/test';

test('REQ-4.6.2: Continue Shopping After Add', async ({ page }) => {
  // 1. Navigation & Action
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();
  await page.getByRole('button', { name: /add to cart/i }).click();

  // 2. Interaction
  const modal = page.getByRole('dialog').or(page.locator('#blockcart-modal'));
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: /continue shopping/i }).click();

  // 3. Assertion
  await expect(modal).not.toBeVisible();
});
