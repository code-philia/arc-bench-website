import { expect, test } from '@playwright/test';
import { openAccountAccess, openPasswordSettings, signIn, verifiedAccount } from './support/e2e';

test('REQ-1-3：使用当前密码修改密码后，新密码可用于后续登录', async ({ page }, testInfo) => {
  const account = verifiedAccount(testInfo, 'E2E_PASSWORD_CHANGE');
  const newPassword = process.env.E2E_PASSWORD_CHANGE_NEW_PASSWORD;
  testInfo.skip(!newPassword, 'Set E2E_PASSWORD_CHANGE_NEW_PASSWORD to a compliant unused password.');
  await signIn(page, account);
  await openPasswordSettings(page);

  await page.getByLabel(/current password|当前密码/i).fill(account.password);
  await page.getByLabel(/^new password$|新密码$/i).fill(newPassword!);
  await page.getByLabel(/confirm.*password|确认.*密码/i).fill(newPassword!);
  await page.getByRole('button', { name: /update password|更新密码/i }).click();
  await expect(page.getByText(/password.*(updated|changed)|密码.*(已更新|已修改)/i)).toBeVisible();

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign in/i }).click();
  await page.getByLabel(/username or email|login|用户名或邮箱/i).fill(account.email);
  await page.getByLabel(/^password$|密码$/i).fill(newPassword!);
  await page.getByRole('button', { name: /sign in|登录/i }).click();
  await expect(page.getByText(account.username, { exact: true })).toBeVisible();
});

test('REQ-1-3：当前密码错误或确认密码不一致时，密码不会被修改', async ({ page }, testInfo) => {
  const account = verifiedAccount(testInfo, 'E2E_PASSWORD_CHANGE');
  await signIn(page, account);
  await openPasswordSettings(page);

  await page.getByLabel(/current password|当前密码/i).fill(`${account.password}-wrong`);
  await page.getByLabel(/^new password$|新密码$/i).fill('Another-valid-password-123!');
  await page.getByLabel(/confirm.*password|确认.*密码/i).fill('does-not-match');
  await page.getByRole('button', { name: /update password|更新密码/i }).click();
  await expect(page.getByText(/current password.*(incorrect|invalid)|password.*(match|一致)|当前密码.*错误|密码.*不一致/i)).toBeVisible();

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign in/i }).click();
  await page.getByLabel(/username or email|login|用户名或邮箱/i).fill(account.email);
  await page.getByLabel(/^password$|密码$/i).fill(account.password);
  await page.getByRole('button', { name: /sign in|登录/i }).click();
  await expect(page.getByText(account.username, { exact: true })).toBeVisible();
});

test('REQ-1-3：缺失当前密码时拒绝更新，旧密码保持有效', async ({ page }, testInfo) => {
  const account = verifiedAccount(testInfo, 'E2E_PASSWORD_CHANGE_REQUIRED');
  const candidate = process.env.E2E_PASSWORD_CHANGE_REQUIRED_NEW_PASSWORD;
  testInfo.skip(!candidate, 'Set E2E_PASSWORD_CHANGE_REQUIRED_NEW_PASSWORD for this isolated account.');
  await signIn(page, account);
  await openPasswordSettings(page);

  await page.getByLabel(/^new password$|新密码$/i).fill(candidate!);
  await page.getByLabel(/confirm.*password|确认.*密码/i).fill(candidate!);
  await page.getByRole('button', { name: /update password|更新密码/i }).click();
  await expect(page.getByText(/current password.*required|当前密码.*必填/i)).toBeVisible();

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign in/i }).click();
  await page.getByLabel(/username or email|login|用户名或邮箱/i).fill(account.email);
  await page.getByLabel(/^password$|密码$/i).fill(account.password);
  await page.getByRole('button', { name: /sign in|登录/i }).click();
  await expect(page.getByText(account.username, { exact: true })).toBeVisible();
});
