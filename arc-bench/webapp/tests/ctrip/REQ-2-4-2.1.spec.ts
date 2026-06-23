import { test, expect } from '@playwright/test';

test('REQ-2-4-2.1: Enter Verification Information', async ({ page }) => {
  // 1. Navigation
  await page.goto('/register');

  // Dismiss the agreement modal first
  await page.getByRole('button', { name: /同意并继续/i }).click();

  // 2. Interaction - fill phone and send verification code
  await page.getByPlaceholder(/手机号/i).fill('13800138000');

  // Send code via API to get the actual code value
  const sendRes = await page.request.post('http://localhost:3003/api/auth/send-code', {
    data: { phone: '13800138000' },
  });
  const sendData = await sendRes.json();
  const actualCode = sendData.data?.code;

  // Also click the send code button in UI to trigger countdown
  await page.getByRole('button', { name: /发送验证码/i }).click();

  // Fill in the actual verification code
  await page.getByPlaceholder(/验证码/i).fill(actualCode);
  await page.getByRole('button', { name: /下一步/i }).click();

  // 3. Assertion - verify we moved to step 2 (设置密码 step is active)
  await expect(page.getByPlaceholder(/密码/i).first()).toBeVisible();
});
