import { test, expect } from '@playwright/test';

test('REQ-8.2: Quick Navigation from Favorites', async ({ page }) => {
  // 1. Navigation
  await page.goto('/'); // The homepage contains "My Most Viewed Favorites" list

  // 2. Interaction
  // Target the 'My Most Viewed Favorites' section
  const favoritesSection = page.getByRole('heading', { name: /My Most Viewed Favorites/i }).locator('..');
  
  // Find the first favorited item link and click it
  const firstFavoriteItem = favoritesSection.getByRole('link').first();
  await firstFavoriteItem.click();

  // 3. Assertion
  // Should navigate to the details page of the favorited item
  await expect(page).not.toHaveURL(/\/?$/); // Navigate away from homepage
  await expect(page.getByRole('heading')).toBeVisible(); // Target page loads
});
