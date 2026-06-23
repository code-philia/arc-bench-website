import { test, expect } from '@playwright/test';

test('REQ-5.4.2: Cancel Book Edits', async ({ page }) => {
  // 1. Navigation
  await page.goto('/books/1/edit'); // Navigate to book edit page

  // 2. Interaction
  await page.getByRole('link', { name: /Cancel/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/books\/1/);
});
