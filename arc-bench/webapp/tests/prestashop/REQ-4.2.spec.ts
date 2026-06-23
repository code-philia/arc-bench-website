import { test, expect } from '@playwright/test';

test('REQ-4.2: Product Image Area', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();

  // 2. Assertion
  const imageContainer = page.locator('.product-cover').or(page.getByRole('img', { name: /cover/i }).first());
  await expect(imageContainer).toBeVisible();
});
