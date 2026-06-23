import { test, expect } from '@playwright/test';

test('REQ-4.5.1: Save Shelf Edits', async ({ page }) => {
  // 1. Navigation
  await page.goto('/shelves/1'); // Shelf details page

  // 2. Interaction
  await page.getByRole('link', { name: /Edit/i }).click();
  await page.getByLabel(/Name/i).fill('Updated Shelf Name');
  await page.getByLabel(/Description/i).fill('Updated shelf description.');
  await page.getByRole('button', { name: /Save Shelf/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/shelves\/1/);
  await expect(page.getByText(/Updated Shelf Name/i)).toBeVisible();
});
