import { test, expect } from '@playwright/test';

test('REQ-4.3.2: Cancel Creation', async ({ page }) => {
  // 1. Navigation
  await page.goto('/shelves/create'); // Directly navigating to create page or from shelf details

  // 2. Interaction
  await page.getByRole('link', { name: /Cancel/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/shelves/);
});
