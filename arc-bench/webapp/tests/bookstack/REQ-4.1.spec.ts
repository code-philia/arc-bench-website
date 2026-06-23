import { test, expect } from '@playwright/test';

test('REQ-4.1: View Shelf List', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('link', { name: /Shelves/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/shelves/);
  await expect(page.getByRole('heading', { name: /Shelves/i })).toBeVisible();
});
