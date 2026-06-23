import { test, expect } from '@playwright/test';

test('REQ-5.2.1: Enter Book Details Page through Book List Page', async ({ page }) => {
  // 1. Navigation
  await page.goto('/books');

  // 2. Interaction
  await page.getByRole('link', { name: /Book/i }).first().click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/books\/.+/);
  await expect(page.getByRole('heading')).toBeVisible();
});
