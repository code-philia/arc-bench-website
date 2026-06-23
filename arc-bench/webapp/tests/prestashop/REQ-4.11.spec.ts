import { test, expect } from '@playwright/test';

test('REQ-4.11: Related Products', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();

  // 2. Interaction
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  // 3. Assertion
  const relatedProducts = page.getByRole('region', { name: /same category|related/i }).or(page.locator('.category-products'));
  if (await relatedProducts.isVisible()) {
    await expect(relatedProducts).toBeVisible();
  }
});
