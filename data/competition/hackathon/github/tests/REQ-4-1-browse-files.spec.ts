import { expect, test } from '@playwright/test';
import { requiredEnv } from './support/e2e';

test('REQ-4-1：用户可逐级浏览目录并查看所选分支中的文件内容', async ({ page }, testInfo) => {
  const repositoryUrl = requiredEnv(testInfo, 'E2E_CODE_REPOSITORY_URL');
  const directory = requiredEnv(testInfo, 'E2E_CODE_DIRECTORY');
  const fileName = requiredEnv(testInfo, 'E2E_CODE_FILE_NAME');
  const expectedContent = requiredEnv(testInfo, 'E2E_CODE_FILE_CONTENT');

  await page.goto(repositoryUrl);
  await page.getByRole('link', { name: directory, exact: true }).click();
  await page.getByRole('link', { name: fileName, exact: true }).click();
  await expect(page.getByText(expectedContent, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(expectedContent, { exact: true })).toBeVisible();
});
