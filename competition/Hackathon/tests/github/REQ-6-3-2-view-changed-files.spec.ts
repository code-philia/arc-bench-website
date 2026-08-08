import { expect, test } from '@playwright/test';
import { requiredEnv } from './support/e2e';

test('REQ-6-3-2：访客查看拉取请求差异时可看到文件路径和增删行汇总', async ({ page }, testInfo) => {
  const pullRequestUrl = requiredEnv(testInfo, 'E2E_PUBLIC_PULL_REQUEST_URL');
  const changedFile = requiredEnv(testInfo, 'E2E_PR_CHANGED_FILE');

  await page.goto(pullRequestUrl);
  await page.getByRole('link', { name: /files changed|已更改文件/i }).click();
  await expect(page.getByText(changedFile, { exact: true })).toBeVisible();
  await expect(page.getByText(/\+\d+.*-\d+|\d+ additions?.*\d+ deletions?|新增.*删除/i)).toBeVisible();
});
