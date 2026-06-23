import { test, expect } from '@playwright/test';

test('REQ-4.4.2: Cancel Delete Shelf', async ({ page }) => {
  // 1. Navigation
  await page.goto('/shelves/1/delete'); // Navigate to delete confirmation page

  // 2. Interaction
  await page.getByRole('link', { name: /Cancel/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/shelves\/1/);
});
