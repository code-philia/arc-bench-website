import { test, expect } from '@playwright/test';

test('REQ-7.1: Add to Recently Viewed', async ({ page }) => {
  // 1. Navigation
  // Browse some content (e.g., a book details page)
  await page.goto('/books/1'); 
  
  // Navigate back to the homepage to check the list
  await page.goto('/');

  // 2. Interaction
  // (The act of viewing in step 1 is the interaction)

  // 3. Assertion
  // The 'My Recently Viewed' section should exist and contain items
  const recentlyViewedSection = page.getByRole('heading', { name: /My Recently Viewed/i }).locator('..');
  await expect(recentlyViewedSection).toBeVisible();
  
  // We assume there's at least one item (the book we just viewed) listed here.
  // Using a generic check for links within that specific section.
  const viewedItems = recentlyViewedSection.getByRole('link');
  await expect(viewedItems.first()).toBeVisible();
});
