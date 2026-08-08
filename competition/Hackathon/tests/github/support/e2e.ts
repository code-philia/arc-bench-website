import { expect, Page, TestInfo } from '@playwright/test';

export type VerifiedAccount = {
  username: string;
  email: string;
  password: string;
};

/**
 * REQ-1 does not specify a user-visible email-verification flow.  Tests that
 * require an already verified account therefore receive one from the test
 * environment instead of relying on an implementation-specific API or store.
 */
export function verifiedAccount(testInfo: TestInfo, prefix: string): VerifiedAccount {
  const username = process.env[`${prefix}_USERNAME`];
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];

  testInfo.skip(
    !username || !email || !password,
    `Set ${prefix}_USERNAME, ${prefix}_EMAIL and ${prefix}_PASSWORD to run this scenario.`,
  );

  return { username: username!, email: email!, password: password! };
}

export function requiredEnv(testInfo: TestInfo, name: string): string {
  const value = process.env[name];
  testInfo.skip(!value, `Set ${name} to run this scenario.`);
  return value!;
}

export function baseUrl(): string {
  return process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
}

export async function openAccountAccess(page: Page): Promise<void> {
  await page.goto(baseUrl());
}

export async function signIn(page: Page, account: VerifiedAccount): Promise<void> {
  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign in/i }).click();
  await page.getByLabel(/username or email|login|用户名或邮箱/i).fill(account.username);
  await page.getByLabel(/^password$|密码$/i).fill(account.password);
  await page.getByRole('button', { name: /sign in|登录/i }).click();
  await expect(page.getByText(account.username, { exact: true })).toBeVisible();
}

export function uniqueAccount(): VerifiedAccount {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const username = `pw-user-${suffix}`;

  return {
    username,
    email: `${username}@example.test`,
    password: 'Valid-password-123!',
  };
}

export async function openPasswordSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: /account menu|账户菜单/i }).click();
  await page.getByRole('link', { name: /settings|设置/i }).click();
  await page.getByRole('link', { name: /password and authentication|password|密码/i }).click();
}
