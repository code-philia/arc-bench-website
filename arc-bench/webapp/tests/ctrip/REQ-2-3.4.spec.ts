import { test, expect } from '@playwright/test';

test('REQ-2-3.4: Exception Incorrect Verification Code', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');
  await page.getByText(/验证码登录/i).click();

  // 2. Interaction
  await page.getByPlaceholder(/手机号/i).fill('13800138000');
  await page.getByRole('button', { name: /发送验证码/i }).click();
  await page.getByPlaceholder(/验证码/i).fill('654321');
  await page.getByRole('checkbox', { name: /阅读并同意/i }).check();
  await page.getByRole('button', { name: /登录/i }).click();

  // 3. Assertion
  await expect(page.getByText(/验证码错误/i)).toBeVisible();
});
