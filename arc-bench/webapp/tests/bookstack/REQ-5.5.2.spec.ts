import { test, expect } from '@playwright/test';

test('REQ-5.5.2: Cancel Delete Book', async ({ page }) => {
  // 1. Navigation
  await page.goto('/books/1/delete'); // Navigate to book delete confirmation page

  // 2. Interaction
  await page.getByRole('link', { name: /Cancel/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/books\/1/);
});
