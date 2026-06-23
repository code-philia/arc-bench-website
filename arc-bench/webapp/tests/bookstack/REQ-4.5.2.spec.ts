import { test, expect } from '@playwright/test';

test('REQ-4.5.2: Cancel Shelf Edits', async ({ page }) => {
  // 1. Navigation
  await page.goto('/shelves/1/edit'); // Shelf edit page

  // 2. Interaction
  await page.getByRole('link', { name: /Cancel/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/shelves\/1/);
});
