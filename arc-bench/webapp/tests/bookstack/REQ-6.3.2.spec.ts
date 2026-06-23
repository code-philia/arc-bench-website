import { test, expect } from '@playwright/test';

test('REQ-6.3.2: Redirect to Page Edit Page', async ({ page }) => {
  // 1. Navigation
  await page.goto('/books/1/page/1'); // Navigate to a specific page reading view

  // 2. Interaction
  await page.getByRole('link', { name: /Edit/i }).click();

  // 3. Assertion
  // Should redirect to the edit view of that page
  await expect(page).toHaveURL(/\/books\/1\/page\/edit\/1/);
});
