import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, uniqueAccount, verifiedAccount } from './support/e2e';

test('REQ-5-2-3：已登录用户发布非空评论后，评论和作者持久化在时间线中', async ({ page }, testInfo) => {
  const commenter = verifiedAccount(testInfo, 'E2E_ISSUE_COMMENTER');
  const issueUrl = requiredEnv(testInfo, 'E2E_COMMENTABLE_ISSUE_URL');
  const comment = `Playwright comment ${uniqueAccount().username.slice(-10)}`;

  await signIn(page, commenter);
  await page.goto(issueUrl);
  await page.getByLabel(/comment|评论/i).fill(comment);
  await page.getByRole('button', { name: /^comment$|发表评论/i }).click();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
  await expect(page.getByText(commenter.username, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
});

test('REQ-5-2-3：空白或纯空格评论不会新增时间线记录', async ({ page }, testInfo) => {
  const commenter = verifiedAccount(testInfo, 'E2E_ISSUE_COMMENTER');
  const issueUrl = requiredEnv(testInfo, 'E2E_COMMENT_VALIDATION_ISSUE_URL');

  await signIn(page, commenter);
  await page.goto(issueUrl);
  const timelineItems = page.getByRole('article');
  const beforeCount = await timelineItems.count();
  const commentButton = page.getByRole('button', { name: /^comment$|发表评论/i });

  await page.getByLabel(/comment|评论/i).fill('   ');
  if (await commentButton.isEnabled()) {
    await commentButton.click();
    await expect(page.getByText(/comment.*required|comment.*empty|评论.*必填|评论.*为空/i)).toBeVisible();
  } else {
    await expect(commentButton).toBeDisabled();
  }

  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(beforeCount);
});
