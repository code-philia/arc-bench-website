import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-6-6.1: Email Verification Flow', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/security');

  // 2. Interaction
  await page.getByRole('button', { name: /修改/i }).nth(2).click(); // Assuming third one is email
  await page.getByRole('button', { name: /发送验证码/i }).click();
  await page.getByPlaceholder(/验证码/i).fill('123456');
  await page.getByRole('button', { name: /下一步/i }).click();

  // 3. Assertion
  await expect(page.getByText(/验证新邮箱/i)).toBeVisible();
});
