import { test, expect } from '@playwright/test';

test('REQ-2-2.3: Error - Weak Password', async ({ page }) => {
  // 1. Navigation
  await page.goto('/register');

  // 2. Interaction
  await page.getByLabel(/email/i).fill('newuser@example.com');
  await page.getByRole('textbox', { name: /password/i }).fill('123'); // Too short
  await page.getByRole('button', { name: /sign up/i }).click();

  // 3. Assertion
  await expect(page.getByText(/(?:at least|minimum|more than).*8 characters.*(?:at least|minimum|more than)/i)).toBeVisible();
});
