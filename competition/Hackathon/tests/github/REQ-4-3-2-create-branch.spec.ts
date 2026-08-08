import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, uniqueAccount, verifiedAccount } from './support/e2e';

test('REQ-4-3-2：有协作权限的用户从现有修订创建并切换到新分支', async ({ page }, testInfo) => {
  const contributor = verifiedAccount(testInfo, 'E2E_BRANCH_CONTRIBUTOR');
  const repositoryUrl = requiredEnv(testInfo, 'E2E_BRANCH_REPOSITORY_URL');
  const branchName = `pw-branch-${uniqueAccount().username.slice(-12)}`;

  await signIn(page, contributor);
  await page.goto(repositoryUrl);
  await page.getByRole('button', { name: /branch|分支/i }).click();
  await page.getByRole('textbox', { name: /find.*branch|搜索.*分支/i }).fill(branchName);
  await page.getByRole('option', { name: new RegExp(`create branch.*${branchName}|创建分支.*${branchName}`, 'i') }).click();
  await expect(page.getByRole('button', { name: new RegExp(branchName, 'i') })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: new RegExp(branchName, 'i') })).toBeVisible();
});

test('REQ-4-3-2：非法分支名不会创建分支', async ({ page }, testInfo) => {
  const contributor = verifiedAccount(testInfo, 'E2E_BRANCH_CONTRIBUTOR');
  const repositoryUrl = requiredEnv(testInfo, 'E2E_BRANCH_REPOSITORY_URL');
  await signIn(page, contributor);
  await page.goto(repositoryUrl);
  await page.getByRole('button', { name: /branch|分支/i }).click();
  await page.getByRole('textbox', { name: /find.*branch|搜索.*分支/i }).fill('invalid..branch');
  await expect(page.getByText(/invalid.*branch|分支.*无效/i)).toBeVisible();
});
