import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, uniqueAccount, verifiedAccount } from './support/e2e';

test('REQ-6-3-3：评审者在变更行添加单条评论后，评论会显示在讨论中', async ({ page }, testInfo) => {
  const reviewer = verifiedAccount(testInfo, 'E2E_PR_REVIEWER');
  const pullRequestUrl = requiredEnv(testInfo, 'E2E_REVIEWABLE_PULL_REQUEST_URL');
  const comment = `Review comment ${uniqueAccount().username.slice(-10)}`;

  await signIn(page, reviewer);
  await page.goto(pullRequestUrl);
  await page.getByRole('link', { name: /files changed|已更改文件/i }).click();
  await page.getByRole('button', { name: /add.*comment|添加.*评论/i }).first().click();
  await page.getByLabel(/comment|评论/i).fill(comment);
  await page.getByRole('button', { name: /add single comment|添加单条评论/i }).click();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
});

test('REQ-6-3-3：开始评审时行内评论保持待提交状态而不立即发布', async ({ page }, testInfo) => {
  const reviewer = verifiedAccount(testInfo, 'E2E_PR_REVIEWER');
  const pullRequestUrl = requiredEnv(testInfo, 'E2E_PENDING_REVIEW_PULL_REQUEST_URL');
  const comment = `Pending review comment ${uniqueAccount().username.slice(-10)}`;

  await signIn(page, reviewer);
  await page.goto(pullRequestUrl);
  await page.getByRole('link', { name: /files changed|已更改文件/i }).click();
  await page.getByRole('button', { name: /add.*comment|添加.*评论/i }).first().click();
  await page.getByLabel(/comment|评论/i).fill(comment);
  await page.getByRole('button', { name: /start a review|开始评审/i }).click();

  await expect(page.getByText(comment, { exact: true })).toBeVisible();
  await expect(page.getByText(/pending|pending review|待提交|待评审/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/pending|pending review|待提交|待评审/i)).toBeVisible();
});
