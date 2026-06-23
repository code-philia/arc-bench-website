import { test, expect } from '@playwright/test';

test('REQ-7.4: Forgot Password', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByRole('link', { name: /forgot your password/i }).click();
  await expect(page).toHaveURL(/.*password.*/i);

  await page.getByRole('textbox', { name: /email/i }).fill('test@example.com');
  await page.getByRole('button', { name: /send/i }).click();

  // 3. Assertion
  await expect(page.getByText(/if this email address has been registered/i).or(page.locator('.item-success'))).toBeVisible();
});
