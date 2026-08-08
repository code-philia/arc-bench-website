import { expect, test } from '@playwright/test';
import { requiredEnv } from './support/e2e';

test('REQ-4-2-2：用户打开提交后可查看变更文件和新增/删除差异', async ({ page }, testInfo) => {
  const commitUrl = requiredEnv(testInfo, 'E2E_COMMIT_URL');
  const changedFile = requiredEnv(testInfo, 'E2E_CHANGED_FILE');

  await page.goto(commitUrl);
  await expect(page.getByText(changedFile, { exact: true })).toBeVisible();
  await expect(page.getByText(/changed files|changed|已更改文件|变更/i)).toBeVisible();
  await expect(page.getByText(/\+\d+.*-\d+|\d+ additions?.*\d+ deletions?|\d+ 行新增.*\d+ 行删除/i)).toBeVisible();
});
