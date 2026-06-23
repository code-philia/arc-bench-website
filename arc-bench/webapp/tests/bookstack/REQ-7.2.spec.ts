import { test, expect } from '@playwright/test';

test('REQ-7.2: Quick Navigation from Recently Viewed', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  const recentlyViewedSection = page.getByRole('heading', { name: /My Recently Viewed/i }).locator('..');
  const firstViewedItem = recentlyViewedSection.getByRole('link').first();
  
  // Click the first item in the recently viewed list
  await firstViewedItem.click();

  // 3. Assertion
  // Should navigate away from the homepage (to a shelf, book, chapter, or page details page)
  await expect(page).not.toHaveURL(/\/?$/); // URL should not be just root anymore
  await expect(page.getByRole('heading')).toBeVisible(); // Target page should load
});
