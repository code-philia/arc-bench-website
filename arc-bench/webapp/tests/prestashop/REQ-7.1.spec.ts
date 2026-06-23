import { test, expect } from '@playwright/test';

test('REQ-7.1: Enter Login Page', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('banner').getByRole('link', { name: /sign in/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/.*login.*/i);
  await expect(page.getByRole('heading', { name: /log in to your account/i })).toBeVisible();
});
