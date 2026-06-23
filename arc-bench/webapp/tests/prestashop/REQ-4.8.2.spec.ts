import { test, expect } from '@playwright/test';

test('REQ-4.8.2: View Product Details Tab', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();

  // 2. Interaction
  const detailsTab = page.getByRole('tab', { name: /product details/i });
  await detailsTab.click();

  // 3. Assertion
  const detailsContent = page.getByRole('tabpanel', { name: /product details/i }).or(page.locator('.product-features'));
  await expect(detailsContent).toBeVisible();
});
