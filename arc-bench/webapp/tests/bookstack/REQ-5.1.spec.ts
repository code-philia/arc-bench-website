import { test, expect } from '@playwright/test';

test('REQ-5.1: View Books List', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('link', { name: /Books/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/books/);
  await expect(page.getByRole('heading', { name: /Books/i })).toBeVisible();
});
