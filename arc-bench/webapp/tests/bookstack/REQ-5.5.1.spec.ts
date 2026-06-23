import { test, expect } from '@playwright/test';

test('REQ-5.5.1: Confirm Delete Book', async ({ page }) => {
  // 1. Navigation
  await page.goto('/books/1'); // Navigate to book details

  // 2. Interaction
  await page.getByRole('link', { name: /Delete/i }).click();
  await page.getByRole('button', { name: /Confirm/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/books/);
});
