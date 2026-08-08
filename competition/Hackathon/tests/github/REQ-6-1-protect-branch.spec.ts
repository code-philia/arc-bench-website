import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-6-1：管理员保存分支保护规则后，规则在重新打开时仍可见', async ({ page }, testInfo) => {
  const administrator = verifiedAccount(testInfo, 'E2E_PROTECTION_ADMIN');
  const repositoryUrl = requiredEnv(testInfo, 'E2E_PROTECTION_REPOSITORY_URL');
  const pattern = requiredEnv(testInfo, 'E2E_PROTECTED_BRANCH_PATTERN');

  await signIn(page, administrator);
  await page.goto(repositoryUrl);
  await page.getByRole('link', { name: /settings|设置/i }).click();
  await page.getByRole('link', { name: /branches|分支/i }).click();
  await page.getByRole('button', { name: /add branch protection rule|添加分支保护规则/i }).click();
  await page.getByLabel(/branch name pattern|分支名称模式/i).fill(pattern);
  await page.getByRole('checkbox', { name: /require.*review|要求.*评审/i }).check();
  await page.getByRole('button', { name: /create|save changes|创建|保存/i }).click();
  await page.reload();
  await expect(page.getByText(pattern, { exact: true })).toBeVisible();
});

test('REQ-6-1：非仓库管理员不能创建或修改分支保护规则', async ({ page }, testInfo) => {
  const nonAdministrator = verifiedAccount(testInfo, 'E2E_PROTECTION_NON_ADMIN');
  const repositoryUrl = requiredEnv(testInfo, 'E2E_PROTECTION_REPOSITORY_URL');

  await signIn(page, nonAdministrator);
  await page.goto(repositoryUrl);

  const settingsLink = page.getByRole('link', { name: /settings|设置/i });
  if ((await settingsLink.count()) > 0) {
    await settingsLink.click();
    const branchesLink = page.getByRole('link', { name: /branches|分支/i });
    if ((await branchesLink.count()) > 0) {
      await branchesLink.click();
    }
  }

  await expect(
    page.getByRole('button', { name: /add branch protection rule|添加分支保护规则/i }),
  ).toHaveCount(0);
});
