import { expect, test } from '@playwright/test';
import { openAccountAccess, signIn, verifiedAccount } from './support/e2e';

test('REQ-1-1-2：已验证账户使用正确凭据登录，并在重新打开后保持会话', async ({ page }, testInfo) => {
  const account = verifiedAccount(testInfo, 'E2E_LOGIN');

  await signIn(page, account);
  await page.reload();
  await expect(page.getByText(account.username, { exact: true })).toBeVisible();
});

test('REQ-1-1-2：错误凭据只显示通用失败信息且不创建会话', async ({ page }, testInfo) => {
  const account = verifiedAccount(testInfo, 'E2E_LOGIN');

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign in/i }).click();
  await page.getByLabel(/username or email|login|用户名或邮箱/i).fill(account.email);
  await page.getByLabel(/^password$|密码$/i).fill(`${account.password}-incorrect`);
  await page.getByRole('button', { name: /sign in|登录/i }).click();

  await expect(page.getByText(/incorrect.*username.*password|invalid credentials|登录.*失败|凭据.*错误/i)).toBeVisible();
  await expect(page.getByText(account.username, { exact: true })).not.toBeVisible();
});

test('REQ-1-1-2：使用已验证邮箱而非登录名也能建立会话', async ({ page }, testInfo) => {
  const account = verifiedAccount(testInfo, 'E2E_LOGIN_EMAIL');

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign in/i }).click();
  await page.getByLabel(/username or email|login|用户名或邮箱/i).fill(account.email);
  await page.getByLabel(/^password$|密码$/i).fill(account.password);
  await page.getByRole('button', { name: /sign in|登录/i }).click();

  await expect(page.getByText(account.username, { exact: true })).toBeVisible();
});

test('REQ-1-1-2：未知账户与错误密码显示相同的通用失败结果', async ({ page }, testInfo) => {
  const account = verifiedAccount(testInfo, 'E2E_LOGIN');
  const failure = /incorrect.*username.*password|invalid credentials|登录.*失败|凭据.*错误/i;

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign in/i }).click();
  await page.getByLabel(/username or email|login|用户名或邮箱/i).fill(`unknown-${Date.now()}@example.test`);
  await page.getByLabel(/^password$|密码$/i).fill(account.password);
  await page.getByRole('button', { name: /sign in|登录/i }).click();
  const unknownResult = page.getByText(failure);
  await expect(unknownResult).toBeVisible();
  const unknownMessage = await unknownResult.textContent();

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign in/i }).click();
  await page.getByLabel(/username or email|login|用户名或邮箱/i).fill(account.username);
  await page.getByLabel(/^password$|密码$/i).fill(`${account.password}-wrong`);
  await page.getByRole('button', { name: /sign in|登录/i }).click();
  await expect(page.getByText(unknownMessage!)).toBeVisible();
});
