import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-6-4：作者请求并移除评审者后，评审者区域同步更新', async ({ page }, testInfo) => {
  const author = verifiedAccount(testInfo, 'E2E_PR_AUTHOR');
  const pullRequestUrl = requiredEnv(testInfo, 'E2E_ASSIGNABLE_PULL_REQUEST_URL');
  const reviewer = requiredEnv(testInfo, 'E2E_REQUESTED_REVIEWER');

  await signIn(page, author);
  await page.goto(pullRequestUrl);
  await page.getByRole('button', { name: /reviewers|评审者/i }).click();
  await page.getByRole('textbox', { name: /search|搜索/i }).fill(reviewer);
  await page.getByRole('option', { name: reviewer, exact: true }).click();
  await expect(page.getByText(reviewer, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(reviewer, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`remove.*${reviewer}|移除.*${reviewer}`, 'i') }).click();
  await expect(page.getByText(reviewer, { exact: true })).not.toBeVisible();
});
