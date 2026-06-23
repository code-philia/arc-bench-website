import { test, expect } from '@playwright/test';

test('REQ-2-4-3.2: Exception Passwords Do Not Match', async ({ page }) => {
  // 1. Navigation
  await page.goto('/register/password');

  // 2. Interaction
  await page.getByPlaceholder(/^密码$/i).fill('Password123');
  await page.getByPlaceholder(/确认密码/i).fill('Password1234');
  await page.getByRole('button', { name: /完成注册/i }).click();

  // 3. Assertion
  await expect(page.getByText(/两次输入的密码不一致/i)).toBeVisible();
});
