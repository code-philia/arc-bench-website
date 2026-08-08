import { expect, test } from '@playwright/test';
import { signIn, uniqueAccount, verifiedAccount } from './support/e2e';

test('REQ-3-2-1：已登录用户以指定可见性和 README 初始化创建仓库', async ({ page }, testInfo) => {
  const owner = verifiedAccount(testInfo, 'E2E_REPOSITORY_OWNER');
  const repositoryName = `pw-repository-${uniqueAccount().username.slice(-12)}`;

  await signIn(page, owner);
  await page.getByRole('link', { name: /new repository|新建仓库/i }).click();
  await page.getByLabel(/repository name|仓库名称/i).fill(repositoryName);
  const description = page.getByLabel(/description|描述/i);
  if (await description.isVisible()) await description.fill('Repository created by Playwright');
  await page.getByRole('radio', { name: /private|私有/i }).check();
  await page.getByRole('checkbox', { name: /add a readme|添加.*readme/i }).check();
  await page.getByRole('button', { name: /create repository|创建仓库/i }).click();

  await expect(page.getByRole('heading', { name: new RegExp(repositoryName, 'i') })).toBeVisible();
  await expect(page.getByText(/private|私有/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /readme/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(repositoryName, 'i') })).toBeVisible();
});

test('REQ-3-2-1：重复仓库名不会创建半完成的仓库', async ({ page }, testInfo) => {
  const owner = verifiedAccount(testInfo, 'E2E_REPOSITORY_OWNER');
  const existingRepository = process.env.E2E_EXISTING_OWNED_REPOSITORY;
  testInfo.skip(!existingRepository, 'Set E2E_EXISTING_OWNED_REPOSITORY to a repository owned by the test account.');

  await signIn(page, owner);
  await page.getByRole('link', { name: /new repository|新建仓库/i }).click();
  await page.getByLabel(/repository name|仓库名称/i).fill(existingRepository!);
  await page.getByRole('button', { name: /create repository|创建仓库/i }).click();

  await expect(page.getByText(/name.*(already|exists|unavailable)|仓库.*(已存在|不可用)/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(existingRepository!, 'i') })).not.toBeVisible();
});

test('REQ-3-2-1：空仓库名不会创建仓库并显示字段错误', async ({ page }, testInfo) => {
  const owner = verifiedAccount(testInfo, 'E2E_REPOSITORY_OWNER');
  await signIn(page, owner);
  await page.getByRole('link', { name: /new repository|新建仓库/i }).click();
  await page.getByRole('button', { name: /create repository|创建仓库/i }).click();
  await expect(page.getByText(/repository name.*required|仓库名称.*必填/i)).toBeVisible();
});
