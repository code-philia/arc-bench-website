import { test, expect } from '@playwright/test';

test('REQ-2-1.2: Switch to Verification-Code Login', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByText(/验证码登录/i).click();

  // 3. Assertion
  await expect(page.getByRole('button', { name: /发送验证码/i })).toBeVisible();
});
