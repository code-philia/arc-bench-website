import { test, expect } from '@playwright/test';

test('REQ-3.5.1: View Product Cards', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // 2. Assertion
  const firstProduct = page.locator('article').first();
  await expect(firstProduct).toBeVisible();
  await expect(firstProduct.getByRole('img')).toBeVisible();
  await expect(firstProduct.getByRole('link').first()).toBeVisible(); // Name
  await expect(firstProduct.locator('.price').or(page.getByText(/\$\d+/))).toBeVisible(); // Price
});
