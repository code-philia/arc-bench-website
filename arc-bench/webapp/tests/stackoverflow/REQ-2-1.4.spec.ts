import { test, expect } from '@playwright/test';

test('REQ-2-1.4: Error - Unregistered Email', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByLabel(/email/i).fill('notfound@example.com');
  await page.getByRole('textbox', { name: /password/i }).fill('any_password');
  await page.getByRole('button', { name: /log in/i }).click();

  // 3. Assertion
  await expect(page.getByText(/no account found with this email/i)).toBeVisible();
});
