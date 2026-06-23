import { test, expect } from '@playwright/test';

test('REQ-4-1-1.1: View Reminder Details', async ({ page }) => {
  // 1. Navigation
  await page.goto('/book');

  // 2. Interaction
  await page.getByRole('button', { name: /展开/i }).first().click(); // Click expand arrow

  // 3. Assertion
  await expect(page.getByText(/民航局/i)).toBeVisible();
});
