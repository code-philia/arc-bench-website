import { test, expect } from '@playwright/test';

test('REQ-8.1: Favorite Items', async ({ page }) => {
  // 1. Navigation
  await page.goto('/books/1'); // Using a book details page as an example

  // 2. Interaction
  // Find the favorite button. Usually it toggles, so we look for 'Favorite' initially.
  const favoriteButton = page.getByRole('button', { name: /Favorite/i }).first();
  await favoriteButton.click();

  // 3. Assertion
  // The button should now reflect the 'Unfavorite' state
  await expect(page.getByRole('button', { name: /Unfavorite/i })).toBeVisible();
});
