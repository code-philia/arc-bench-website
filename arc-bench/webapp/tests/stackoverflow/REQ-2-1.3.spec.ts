import { test, expect } from '@playwright/test';

test('REQ-2-1.3: Error - Invalid Email Format', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByLabel(/email/i).fill('invalid-email-format');
  await page.getByRole('textbox', { name: /password/i }).fill('somepassword');
  await page.getByRole('button', { name: /log in/i }).click();

  // 3. Assertion
  await expect(page.getByText(/the email is not a valid email address/i)).toBeVisible();
});
