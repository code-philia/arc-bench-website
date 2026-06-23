import { test, expect } from '@playwright/test';

test('REQ-4.2.1: Enter Shelf Details Page', async ({ page }) => {
  // 1. Navigation
  await page.goto('/shelves');

  // 2. Interaction
  // Click on the first shelf link found on the page
  await page.getByRole('link', { name: /Shelf/i }).first().click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/shelves\/.+/);
  await expect(page.getByRole('heading')).toBeVisible();
});
