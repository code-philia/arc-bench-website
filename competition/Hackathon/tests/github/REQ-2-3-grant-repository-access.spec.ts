import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-2-3：管理员向团队授予仓库角色后，授权在重新打开时仍可见', async ({ page }, testInfo) => {
  const administrator = verifiedAccount(testInfo, 'E2E_REPOSITORY_ADMIN');
  const repositoryUrl = requiredEnv(testInfo, 'E2E_MANAGED_REPOSITORY_URL');
  const teamName = requiredEnv(testInfo, 'E2E_ACCESS_TEAM_NAME');

  await signIn(page, administrator);
  await page.goto(repositoryUrl);
  await page.getByRole('link', { name: /settings|设置/i }).click();
  await page.getByRole('link', { name: /manage access|管理访问权限/i }).click();
  await page.getByRole('button', { name: /add.*(people|team)|添加.*(人员|团队)/i }).click();
  await page.getByRole('textbox', { name: /search|team|搜索|团队/i }).fill(teamName);
  await page.getByRole('option', { name: new RegExp(teamName, 'i') }).click();
  await page.getByRole('combobox', { name: /role|角色/i }).click();
  await page.getByRole('option', { name: /write|写入/i }).click();
  await page.getByRole('button', { name: /add|save|添加|保存/i }).click();

  await expect(page.getByText(teamName, { exact: true })).toBeVisible();
  await expect(page.getByText(/write|写入/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText(teamName, { exact: true })).toBeVisible();
});

test('REQ-2-3：修改已有团队角色会替换原授权而不会生成重复记录', async ({ page }, testInfo) => {
  const administrator = verifiedAccount(testInfo, 'E2E_REPOSITORY_ADMIN');
  const repositoryUrl = requiredEnv(testInfo, 'E2E_ACCESS_ROLE_CHANGE_REPOSITORY_URL');
  const teamName = requiredEnv(testInfo, 'E2E_ACCESS_ROLE_CHANGE_TEAM_NAME');

  await signIn(page, administrator);
  await page.goto(repositoryUrl);
  await page.getByRole('link', { name: /settings|设置/i }).click();
  await page.getByRole('link', { name: /manage access|管理访问权限/i }).click();

  const accessRow = page.getByRole('row', { name: new RegExp(teamName, 'i') });
  await expect(accessRow).toContainText(/write|写入/i);
  await accessRow.getByRole('combobox', { name: /role|角色/i }).selectOption({
    label: 'Read',
  });
  await accessRow.getByRole('button', { name: /save|update|保存|更新/i }).click();

  await page.reload();
  await expect(page.getByRole('row', { name: new RegExp(teamName, 'i') })).toHaveCount(1);
  await expect(page.getByRole('row', { name: new RegExp(teamName, 'i') })).toContainText(
    /read|读取/i,
  );
});
