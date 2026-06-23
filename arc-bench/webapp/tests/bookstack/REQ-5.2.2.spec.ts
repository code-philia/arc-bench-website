import { test, expect } from '@playwright/test';

test('REQ-5.2.2: Enter Book Details Page through Shelf Details Page', async ({ page }) => {
  // 1. Navigation
  await page.goto('/shelves/1'); // Shelf details page

  // 2. Interaction
  await page.getByRole('link', { name: /Book/i }).first().click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/books\/.+/);
  await expect(page.getByRole('heading')).toBeVisible();
});
