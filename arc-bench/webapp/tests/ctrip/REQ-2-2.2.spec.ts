import { test, expect } from '@playwright/test';

test('REQ-2-2.2: Exception Username Missing', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByPlaceholder(/密码/i).fill('password123');
  await page.getByRole('checkbox', { name: /阅读并同意/i }).check();
  await page.getByRole('button', { name: /登录/i }).click();

  // 3. Assertion
  await expect(page.getByText(/请输入用户名/i)).toBeVisible();
});
