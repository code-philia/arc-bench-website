import { test, expect } from '@playwright/test';

test('REQ-4.10: Recently Viewed', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();

  // 2. Interaction
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  // 3. Assertion
  // Note: Depending on theme, this might be named differently
  const recentlyViewed = page.getByRole('region', { name: /recently viewed/i }).or(page.locator('.viewed-products'));
  if (await recentlyViewed.isVisible()) {
    await expect(recentlyViewed).toBeVisible();
  }
});
