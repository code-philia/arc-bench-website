import { test, expect } from '@playwright/test';

test('REQ-4.3.1: Create Shelf', async ({ page }) => {
  // 1. Navigation
  await page.goto('/shelves/1'); // Navigate to a shelf details page as per scenario

  // 2. Interaction
  await page.getByRole('link', { name: /New Shelf/i }).click();
  await page.getByLabel(/Name/i).fill('New Test Shelf');
  await page.getByLabel(/Description/i).fill('This is a description for the new shelf.');
  await page.getByRole('button', { name: /Save Shelf/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/shelves/);
  await expect(page.getByText(/New Test Shelf/i)).toBeVisible();
});
