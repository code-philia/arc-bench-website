import { test, expect } from '@playwright/test';

test('REQ-2-2.2: Error - Email Already Registered', async ({ page }) => {
  // 1. Navigation
  await page.goto('/register');

  // 2. Interaction
  await page.getByLabel(/email/i).fill('test_user@example.com');
  await page.getByRole('textbox', { name: /password/i }).fill('ValidPass123!');
  await page.getByRole('button', { name: /sign up/i }).click();

  // 3. Assertion
  await expect(page.getByText(/email is already in use/i)).toBeVisible();
});
