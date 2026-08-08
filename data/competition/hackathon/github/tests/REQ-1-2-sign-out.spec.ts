import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-1-2：已登录用户确认退出后，受保护页面重新要求身份验证', async ({ page }, testInfo) => {
  const account = verifiedAccount(testInfo, 'E2E_SIGN_OUT');
  await signIn(page, account);

  await page.getByRole('button', { name: /account menu|账户菜单/i }).click();
  await page.getByRole('link', { name: /sign out|退出登录/i }).click();
  const confirm = page.getByRole('button', { name: /confirm.*sign out|确认.*退出/i });
  if (await confirm.isVisible()) await confirm.click();

  await expect(page.getByRole('link', { name: /sign in|登录/i })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link', { name: /sign in|登录/i })).toBeVisible();
});

test('REQ-1-2：退出后直接重新打开受保护页面仍需重新认证', async ({ page }, testInfo) => {
  const account = verifiedAccount(testInfo, 'E2E_SIGN_OUT');
  const protectedUrl = requiredEnv(testInfo, 'E2E_PROTECTED_URL');
  await signIn(page, account);
  await page.goto(protectedUrl);
  await page.getByRole('button', { name: /account menu|账户菜单/i }).click();
  await page.getByRole('link', { name: /sign out|退出登录/i }).click();
  const confirm = page.getByRole('button', { name: /confirm.*sign out|确认.*退出/i });
  if (await confirm.isVisible()) await confirm.click();

  await page.goto(protectedUrl);
  await expect(page.getByRole('link', { name: /sign in|登录/i })).toBeVisible();
});
