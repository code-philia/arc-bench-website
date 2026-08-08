import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-3-4：仓库管理员确认变更可见性后，访客访问规则同步更新', async ({ page }, testInfo) => {
  const administrator = verifiedAccount(testInfo, 'E2E_VISIBILITY_ADMIN');
  const repositoryUrl = requiredEnv(testInfo, 'E2E_VISIBILITY_REPOSITORY_URL');
  const repositoryName = requiredEnv(testInfo, 'E2E_VISIBILITY_REPOSITORY_NAME');

  await signIn(page, administrator);
  await page.goto(repositoryUrl);
  await page.getByRole('link', { name: /settings|设置/i }).click();
  await page.getByRole('link', { name: /general|常规/i }).click();
  await page.getByRole('button', { name: /change visibility|修改可见性/i }).click();
  await page.getByRole('radio', { name: /public|公开/i }).check();
  await page.getByRole('button', { name: /confirm.*visibility|确认.*可见性|make public|设为公开/i }).click();
  await expect(page.getByText(/public|公开/i)).toBeVisible();

  await page.context().clearCookies();
  await page.goto(repositoryUrl);
  await expect(page.getByRole('heading', { name: new RegExp(repositoryName, 'i') })).toBeVisible();
});

test('REQ-3-4：无管理员权限的用户不能看到可执行的可见性修改入口', async ({ page }, testInfo) => {
  const collaborator = verifiedAccount(testInfo, 'E2E_NON_ADMIN_COLLABORATOR');
  const repositoryUrl = requiredEnv(testInfo, 'E2E_VISIBILITY_REPOSITORY_URL');

  await signIn(page, collaborator);
  await page.goto(repositoryUrl);
  const settings = page.getByRole('link', { name: /settings|设置/i });
  if (await settings.isVisible()) await settings.click();
  await expect(page.getByRole('button', { name: /change visibility|修改可见性/i })).not.toBeVisible();
});
