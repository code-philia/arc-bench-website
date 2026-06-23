import { test, expect } from '@playwright/test';

test('REQ-1.5: User Entry', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('banner').getByRole('link', { name: /sign in/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/.*login.*/i);
});
