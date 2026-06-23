import { test, expect } from '@playwright/test';

test('REQ-2-1.3: Switch to Password Login', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByText(/验证码登录/i).click();
  await page.getByText(/账号登录/i).click();

  // 3. Assertion
  await expect(page.getByPlaceholder(/密码/i)).toBeVisible();
});
