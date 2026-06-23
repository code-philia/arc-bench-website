import { test, expect } from '@playwright/test';

test('REQ-2-3.2: Exception Mobile Number Missing', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');
  await page.getByText(/验证码登录/i).click();

  // 2. Interaction
  await page.getByRole('button', { name: /发送验证码/i }).click();

  // 3. Assertion
  await expect(page.getByText(/请输入手机号/i)).toBeVisible();
});
