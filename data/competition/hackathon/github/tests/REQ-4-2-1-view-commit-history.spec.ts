import { expect, test } from '@playwright/test';
import { requiredEnv } from './support/e2e';

test('REQ-4-2-1：用户可查看分支提交历史中的消息、作者和时间', async ({ page }, testInfo) => {
  const repositoryUrl = requiredEnv(testInfo, 'E2E_CODE_REPOSITORY_URL');
  const commitMessage = requiredEnv(testInfo, 'E2E_COMMIT_MESSAGE');
  const commitAuthor = requiredEnv(testInfo, 'E2E_COMMIT_AUTHOR');

  await page.goto(repositoryUrl);
  await page.getByRole('link', { name: /commits|提交/i }).click();
  await expect(page.getByText(commitMessage, { exact: true })).toBeVisible();
  await expect(page.getByText(commitAuthor, { exact: true })).toBeVisible();
  await expect(page.getByText(/ago|今天|昨天|分钟前|小时前|天前/i).first()).toBeVisible();
});
