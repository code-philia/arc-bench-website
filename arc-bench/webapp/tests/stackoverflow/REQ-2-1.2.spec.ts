import { test, expect } from '@playwright/test';

test('REQ-2-1.2: Error - Empty Credentials', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByRole('button', { name: /log in/i }).click();

  // 3. Assertion
  await expect(page.getByText(/email cannot be empty/i)).toBeVisible();
  await expect(page.getByText(/password cannot be empty/i)).toBeVisible();
});
