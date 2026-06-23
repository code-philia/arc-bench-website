import { test, expect } from '@playwright/test';

test('REQ-2-2.5: Exception Agreement Not Accepted', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByPlaceholder(/手机号|用户名|邮箱/i).fill('13800138000');
  await page.getByPlaceholder(/密码/i).fill('password123');
  await page.getByRole('button', { name: /登录/i }).click();

  // 3. Assertion
  await expect(page.getByText(/请先阅读并勾选协议/i)).toBeVisible();
});
