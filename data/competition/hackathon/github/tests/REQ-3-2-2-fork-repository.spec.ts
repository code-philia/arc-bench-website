import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, uniqueAccount, verifiedAccount } from './support/e2e';

test('REQ-3-2-2：用户将可访问仓库 Fork 到个人命名空间后可查看来源链接', async ({ page }, testInfo) => {
  const account = verifiedAccount(testInfo, 'E2E_FORK_USER');
  const sourceRepositoryUrl = requiredEnv(testInfo, 'E2E_FORK_SOURCE_REPOSITORY_URL');
  const sourceRepositoryName = requiredEnv(testInfo, 'E2E_FORK_SOURCE_REPOSITORY_NAME');
  const forkName = `pw-fork-${uniqueAccount().username.slice(-12)}`;

  await signIn(page, account);
  await page.goto(sourceRepositoryUrl);
  await page.getByRole('button', { name: /fork/i }).click();
  await page.getByLabel(/repository name|仓库名称/i).fill(forkName);
  await page.getByRole('button', { name: /create fork|创建 fork/i }).click();

  await expect(page.getByRole('heading', { name: new RegExp(forkName, 'i') })).toBeVisible();
  await expect(page.getByText(new RegExp(`forked from.*${sourceRepositoryName}|派生自.*${sourceRepositoryName}`, 'i'))).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(forkName, 'i') })).toBeVisible();
});

test('REQ-3-2-2：目标命名空间已有同名 Fork 时不创建第二个 Fork', async ({ page }, testInfo) => {
  const account = verifiedAccount(testInfo, 'E2E_FORK_USER');
  const sourceRepositoryUrl = requiredEnv(testInfo, 'E2E_FORK_SOURCE_REPOSITORY_URL');
  const existingForkName = requiredEnv(testInfo, 'E2E_EXISTING_FORK_NAME');
  await signIn(page, account);
  await page.goto(sourceRepositoryUrl);
  await page.getByRole('button', { name: /fork/i }).click();
  await page.getByLabel(/repository name|仓库名称/i).fill(existingForkName);
  await page.getByRole('button', { name: /create fork|创建 fork/i }).click();
  await expect(page.getByText(/name.*(already|exists)|名称.*已存在/i)).toBeVisible();
});
