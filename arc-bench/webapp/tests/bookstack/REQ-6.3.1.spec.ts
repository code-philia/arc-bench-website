import { test, expect } from '@playwright/test';

test('REQ-6.3.1: Enter Page Reading Page', async ({ page }) => {
  // 1. Navigation
  await page.goto('/books/1'); // Navigate to a book or chapter details page

  // 2. Interaction
  // Find a link that looks like a page within the book's list of contents
  await page.getByRole('link', { name: /Page/i }).first().click();

  // 3. Assertion
  // Should enter the page reading view
  await expect(page).toHaveURL(/\/books\/1\/page\/.+/);
  await expect(page.getByRole('heading')).toBeVisible();
});
