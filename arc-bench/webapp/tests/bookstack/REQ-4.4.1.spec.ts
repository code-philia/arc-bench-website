import { test, expect } from '@playwright/test';

test('REQ-4.4.1: Confirm Delete Shelf', async ({ page }) => {
  // 1. Navigation
  await page.goto('/shelves/1'); // Navigate to shelf details

  // 2. Interaction
  await page.getByRole('link', { name: /Delete/i }).click();
  await page.getByRole('button', { name: /Confirm/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/shelves/);
});
