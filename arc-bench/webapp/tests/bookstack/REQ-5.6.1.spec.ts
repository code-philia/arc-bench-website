import { test, expect } from '@playwright/test';

test('REQ-5.6.1: Fill out and Save Book with Shelf', async ({ page }) => {
  // 1. Navigation
  await page.goto('/shelves/1'); // Navigate to a shelf details page

  // 2. Interaction
  await page.getByRole('link', { name: /Create New Book/i }).click();
  await page.getByLabel(/Name/i).fill('New Shelf Book');
  await page.getByLabel(/Description/i).fill('This is a test book associated with a shelf.');
  await page.getByRole('button', { name: /Save Book/i }).click();

  // 3. Assertion
  // Should redirect to Books list or the new book details page
  await expect(page).toHaveURL(/\/books(\/.+)?/);
  await expect(page.getByText(/New Shelf Book/i)).toBeVisible();
});
