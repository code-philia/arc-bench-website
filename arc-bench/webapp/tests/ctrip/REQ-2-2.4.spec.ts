import { test, expect } from '@playwright/test';

test('REQ-2-2.4: Exception Incorrect Username or Password', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByPlaceholder(/手机号|用户名|邮箱/i).fill('wrong_user');
  await page.getByPlaceholder(/密码/i).fill('wrong_password');
  await page.getByRole('checkbox', { name: /阅读并同意/i }).check();
  await page.getByRole('button', { name: /登录/i }).click();

  // 3. Assertion
  await expect(page.getByText(/用户名或密码错误/i)).toBeVisible();
});
