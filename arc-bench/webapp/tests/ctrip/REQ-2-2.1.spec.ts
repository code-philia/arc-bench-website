import { test, expect } from '@playwright/test';

test('REQ-2-2.1: Password Login Flow', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByPlaceholder(/手机号|用户名|邮箱/i).fill('13800138000');
  await page.getByPlaceholder(/密码/i).fill('password123');
  await page.getByRole('checkbox', { name: /阅读并同意/i }).check();
  await page.getByRole('button', { name: /登录/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\//);
});
