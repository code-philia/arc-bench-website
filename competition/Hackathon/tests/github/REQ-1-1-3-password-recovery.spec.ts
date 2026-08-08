import { expect, test } from '@playwright/test';
import { openAccountAccess, verifiedAccount } from './support/e2e';

test('REQ-1-1-3：重置请求对已验证邮箱和未知邮箱显示相同的通用结果', async ({ page }, testInfo) => {
  const account = verifiedAccount(testInfo, 'E2E_RECOVERY');

  await openAccountAccess(page);
  await page.getByRole('link', { name: /forgot password|忘记密码/i }).click();
  await page.getByLabel(/email|邮箱/i).fill(account.email);
  await page.getByRole('button', { name: /send reset link|发送重置链接/i }).click();
  const result = page.getByText(/check.*email|if.*account.*exists|请检查.*邮箱|如.*账户/i);
  await expect(result).toBeVisible();
  const knownResult = await result.textContent();

  await openAccountAccess(page);
  await page.getByRole('link', { name: /forgot password|忘记密码/i }).click();
  await page.getByLabel(/email|邮箱/i).fill(`unknown-${Date.now()}@example.test`);
  await page.getByRole('button', { name: /send reset link|发送重置链接/i }).click();
  await expect(page.getByText(knownResult ?? '')).toBeVisible();
});

test('REQ-1-1-3：无效重置链接不会更新密码', async ({ page }, testInfo) => {
  const account = verifiedAccount(testInfo, 'E2E_RECOVERY_INVALID');
  const invalidUrl = process.env.E2E_RECOVERY_INVALID_RESET_URL;
  const attemptedPassword = process.env.E2E_RECOVERY_INVALID_NEW_PASSWORD;
  testInfo.skip(!invalidUrl || !attemptedPassword, 'Set invalid reset URL and a compliant candidate password for this isolated account.');

  await page.goto(invalidUrl!);
  await page.getByLabel(/^new password$|新密码$/i).fill(attemptedPassword!);
  await page.getByLabel(/confirm.*password|确认.*密码/i).fill(attemptedPassword!);
  await page.getByRole('button', { name: /reset password|更新密码|重置密码/i }).click();
  await expect(page.getByText(/invalid|expired|used|无效|过期|已使用/i)).toBeVisible();

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign in/i }).click();
  await page.getByLabel(/username or email|login|用户名或邮箱/i).fill(account.email);
  await page.getByLabel(/^password$|密码$/i).fill(account.password);
  await page.getByRole('button', { name: /sign in|登录/i }).click();
  await expect(page.getByText(account.username, { exact: true })).toBeVisible();
});

test('REQ-1-1-3：有效重置链接配合合规新密码更新凭据', async ({ page }, testInfo) => {
  const account = verifiedAccount(testInfo, 'E2E_RECOVERY');
  const resetUrl = process.env.E2E_RECOVERY_RESET_URL;
  const newPassword = process.env.E2E_RECOVERY_NEW_PASSWORD;
  testInfo.skip(!resetUrl || !newPassword, 'Set E2E_RECOVERY_RESET_URL and E2E_RECOVERY_NEW_PASSWORD after obtaining a valid test reset link.');

  await page.goto(resetUrl!);
  await page.getByLabel(/^new password$|新密码$/i).fill(newPassword!);
  await page.getByLabel(/confirm.*password|确认.*密码/i).fill(newPassword!);
  await page.getByRole('button', { name: /reset password|更新密码|重置密码/i }).click();
  await expect(page.getByText(/password.*(updated|changed)|密码.*(已更新|已修改)/i)).toBeVisible();

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign in/i }).click();
  await page.getByLabel(/username or email|login|用户名或邮箱/i).fill(account.email);
  await page.getByLabel(/^password$|密码$/i).fill(newPassword!);
  await page.getByRole('button', { name: /sign in|登录/i }).click();
  await expect(page.getByText(account.username, { exact: true })).toBeVisible();
});
