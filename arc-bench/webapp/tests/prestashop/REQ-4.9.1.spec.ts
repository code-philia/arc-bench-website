import { test, expect } from '@playwright/test';

test('REQ-4.9.1: View Review List', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();

  // 2. Interaction
  const reviewsTab = page.getByRole('tab', { name: /review/i }).or(page.locator('#product-comments-list-header'));
  if (await reviewsTab.isVisible()) {
    await reviewsTab.click();
    
    // 3. Assertion
    const reviewsList = page.locator('#product-comments-list');
    await expect(reviewsList).toBeVisible();
  }
});
