import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-6-6：作者关闭并重新打开拉取请求，状态转换保留在活动记录中', async ({ page }, testInfo) => {
  const author = verifiedAccount(testInfo, 'E2E_PR_AUTHOR');
  const pullRequestUrl = requiredEnv(testInfo, 'E2E_CLOSABLE_PULL_REQUEST_URL');

  await signIn(page, author);
  await page.goto(pullRequestUrl);
  await page.getByRole('button', { name: /close pull request|关闭拉取请求/i }).click();
  await expect(page.getByText(/closed|已关闭/i)).toBeVisible();
  await page.getByRole('button', { name: /reopen pull request|重新打开拉取请求/i }).click();
  await expect(page.getByText(/open|打开/i)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /close pull request|关闭拉取请求/i })).toBeVisible();
});

test('REQ-6-6：非作者且非维护者不能关闭或重新打开拉取请求', async ({ page }, testInfo) => {
  const viewer = verifiedAccount(testInfo, 'E2E_PR_VIEWER');
  const pullRequestUrl = requiredEnv(testInfo, 'E2E_PROTECTED_PULL_REQUEST_URL');

  await signIn(page, viewer);
  await page.goto(pullRequestUrl);
  await expect(
    page.getByRole('button', { name: /close pull request|关闭拉取请求/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /reopen pull request|重新打开拉取请求/i }),
  ).toHaveCount(0);
});
