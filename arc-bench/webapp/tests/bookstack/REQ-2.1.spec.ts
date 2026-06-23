import { test, expect } from '@playwright/test';

test('REQ-2.1: Enter Login Page', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('link', { name: /Login/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: /Login/i })).toBeVisible();
});
