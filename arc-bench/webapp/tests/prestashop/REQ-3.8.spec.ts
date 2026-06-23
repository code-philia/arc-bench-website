import { test, expect } from '@playwright/test';

test('REQ-3.8: Product Count Display', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // 2. Assertion
  const countDisplay = page.locator('.total-products').or(page.getByText(/Showing.*of.*item/i));
  await expect(countDisplay).toBeVisible();
});
