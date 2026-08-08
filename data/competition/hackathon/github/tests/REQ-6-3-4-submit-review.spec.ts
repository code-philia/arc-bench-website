import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-6-3-4：评审者提交批准决定后，拉取请求显示该评审状态', async ({ page }, testInfo) => {
  const reviewer = verifiedAccount(testInfo, 'E2E_PR_REVIEWER');
  const pullRequestUrl = requiredEnv(testInfo, 'E2E_REVIEWABLE_PULL_REQUEST_URL');

  await signIn(page, reviewer);
  await page.goto(pullRequestUrl);
  await page.getByRole('link', { name: /files changed|已更改文件/i }).click();
  await page.getByRole('button', { name: /review changes|评审更改/i }).click();
  await page.getByRole('radio', { name: /approve|批准/i }).check();
  await page.getByRole('button', { name: /submit review|提交评审/i }).click();
  await expect(page.getByText(/approved|已批准/i)).toBeVisible();
});

test('REQ-6-3-4：评审者请求修改时保存评审意见和 Changes requested 状态', async ({ page }, testInfo) => {
  const reviewer = verifiedAccount(testInfo, 'E2E_PR_REVIEWER');
  const pullRequestUrl = requiredEnv(testInfo, 'E2E_CHANGE_REQUEST_PULL_REQUEST_URL');
  const summary = `Please address the failing case ${Date.now()}`;

  await signIn(page, reviewer);
  await page.goto(pullRequestUrl);
  await page.getByRole('link', { name: /files changed|已更改文件/i }).click();
  await page.getByRole('button', { name: /review changes|评审更改/i }).click();
  await page.getByLabel(/summary|comment|评审意见|评论/i).fill(summary);
  await page.getByRole('radio', { name: /request changes|请求修改/i }).check();
  await page.getByRole('button', { name: /submit review|提交评审/i }).click();

  await expect(page.getByText(/changes requested|已请求修改/i)).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/changes requested|已请求修改/i)).toBeVisible();
});
