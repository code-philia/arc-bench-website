import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, uniqueAccount, verifiedAccount } from './support/e2e';

test('REQ-4-4：有写权限的用户通过 Web 编辑器提交文件变更并保留提交历史', async ({ page }, testInfo) => {
  const contributor = verifiedAccount(testInfo, 'E2E_FILE_CONTRIBUTOR');
  const repositoryUrl = requiredEnv(testInfo, 'E2E_FILE_REPOSITORY_URL');
  const fileName = `pw-file-${uniqueAccount().username.slice(-10)}.md`;
  const content = `Playwright content ${Date.now()}`;
  const message = `Add ${fileName}`;

  await signIn(page, contributor);
  await page.goto(repositoryUrl);
  await page.getByRole('button', { name: /add file|添加文件/i }).click();
  await page.getByRole('menuitem', { name: /create new file|创建新文件/i }).click();
  await page.getByLabel(/file name|文件名/i).fill(fileName);
  await page.getByRole('textbox', { name: /file contents|文件内容/i }).fill(content);
  await page.getByLabel(/commit message|提交信息/i).fill(message);
  await page.getByRole('button', { name: /commit changes|提交更改/i }).click();
  await expect(page.getByText(content, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /commits|提交/i }).click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
});

test('REQ-4-4：空提交消息或非法文件路径不会改变分支内容', async ({ page }, testInfo) => {
  const contributor = verifiedAccount(testInfo, 'E2E_FILE_CONTRIBUTOR');
  const repositoryUrl = requiredEnv(testInfo, 'E2E_FILE_REPOSITORY_URL');
  await signIn(page, contributor);
  await page.goto(repositoryUrl);
  await page.getByRole('button', { name: /add file|添加文件/i }).click();
  await page.getByRole('menuitem', { name: /create new file|创建新文件/i }).click();
  await page.getByLabel(/file name|文件名/i).fill('../invalid.md');
  await page.getByRole('textbox', { name: /file contents|文件内容/i }).fill('must not be saved');
  await page.getByRole('button', { name: /commit changes|提交更改/i }).click();
  await expect(page.getByText(/invalid.*path|路径.*无效|commit message.*required|提交信息.*必填/i)).toBeVisible();
});
