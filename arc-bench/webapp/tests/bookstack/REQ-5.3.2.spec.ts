import { test, expect } from '@playwright/test';

test('REQ-5.3.2: Cancel Creating Book', async ({ page }) => {
  // 1. Navigation
  await page.goto('/books/create'); // Create book page

  // 2. Interaction
  await page.getByRole('link', { name: /Cancel/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/books/);
});
