import { test, expect } from '@playwright/test';

test('REQ-2.2: Login successful and enter homepage after login', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByLabel(/Email/i).fill('admin@admin.com');
  await page.getByRole('textbox', { name: /password/i }).fill('password');
  await page.getByLabel(/Remember Me/i).check();
  await page.getByRole('button', { name: /Login/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\//);
  await expect(page.getByRole('link', { name: /Login/i })).not.toBeVisible();
});
