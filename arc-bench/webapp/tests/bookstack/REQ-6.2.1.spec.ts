import { test, expect } from '@playwright/test';

test('REQ-6.2.1: Create Chapter', async ({ page }) => {
  // 1. Navigation
  await page.goto('/books/1'); // Navigate to a book details page

  // 2. Interaction
  await page.getByRole('link', { name: /New Chapter/i }).click();
  await page.getByLabel(/Name/i).fill('New Test Chapter');
  await page.getByLabel(/Description/i).fill('This is a test chapter description.');
  await page.getByRole('button', { name: /Save Chapter/i }).click();

  // 3. Assertion
  // Should add to the book and redirect back to the book details or chapter details
  await expect(page).toHaveURL(/\/books\/1(\/chapter\/.+)?/);
  await expect(page.getByText(/New Test Chapter/i)).toBeVisible();
});
