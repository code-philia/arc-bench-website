import { test, expect } from '@playwright/test';

test('REQ-4.3: Product Basic Info', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();

  // 2. Assertion
  const productInfo = page.locator('.product-information').or(page.locator('h1').locator('..'));
  await expect(productInfo.getByRole('heading')).toBeVisible(); // Name
  await expect(productInfo.locator('.current-price').or(page.getByText(/\$\d+/).first())).toBeVisible(); // Price
  await expect(productInfo.locator('#product-description-short').or(page.getByText(/description/i).first())).toBeVisible();
});
