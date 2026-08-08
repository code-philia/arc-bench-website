import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-4-3-3：管理员修改默认分支后，新打开的仓库使用新分支且旧分支保留', async ({ page }, testInfo) => {
  const administrator = verifiedAccount(testInfo, 'E2E_DEFAULT_BRANCH_ADMIN');
  const repositoryUrl = requiredEnv(testInfo, 'E2E_DEFAULT_BRANCH_REPOSITORY_URL');
  const newDefaultBranch = requiredEnv(testInfo, 'E2E_NEW_DEFAULT_BRANCH');
  const oldDefaultBranch = requiredEnv(testInfo, 'E2E_OLD_DEFAULT_BRANCH');

  await signIn(page, administrator);
  await page.goto(repositoryUrl);
  await page.getByRole('link', { name: /settings|设置/i }).click();
  await page.getByRole('link', { name: /branches|分支/i }).click();
  await page.getByRole('combobox', { name: /default branch|默认分支/i }).selectOption({ label: newDefaultBranch });
  await page.getByRole('button', { name: /update|更新/i }).click();
  await page.getByRole('button', { name: /confirm|确认/i }).click();
  await page.goto(repositoryUrl);
  await expect(page.getByRole('button', { name: new RegExp(newDefaultBranch, 'i') })).toBeVisible();
  await page.getByRole('button', { name: /branch|分支/i }).click();
  await expect(page.getByRole('option', { name: oldDefaultBranch, exact: true })).toBeVisible();
});

test('REQ-4-3-3：没有仓库管理权限的用户不能修改默认分支', async ({ page }, testInfo) => {
  const nonAdministrator = verifiedAccount(testInfo, 'E2E_DEFAULT_BRANCH_NON_ADMIN');
  const repositoryUrl = requiredEnv(testInfo, 'E2E_DEFAULT_BRANCH_REPOSITORY_URL');

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

  await expect(page.getByRole('combobox', { name: /default branch|默认分支/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /update default branch|更新默认分支/i })).toHaveCount(0);
});
