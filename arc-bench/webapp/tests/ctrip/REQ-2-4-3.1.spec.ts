import { test, expect } from '@playwright/test';

test('REQ-2-4-3.1: Set Password and Complete Registration', async ({ page }) => {
  // 1. Navigation
  await page.goto('/register/password');

  // 2. Interaction
  await page.getByPlaceholder(/^密码$/i).fill('Password123');
  await page.getByPlaceholder(/确认密码/i).fill('Password123');
  await page.getByRole('button', { name: /完成注册/i }).click();

  // 3. Assertion
  await expect(page.getByText(/注册成功/i)).toBeVisible();
});
