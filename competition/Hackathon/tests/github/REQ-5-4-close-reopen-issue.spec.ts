import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-5-4：有权限的用户关闭并重新打开议题，状态转换会记录在活动中', async ({ page }, testInfo) => {
  const editor = verifiedAccount(testInfo, 'E2E_ISSUE_EDITOR');
  const issueUrl = requiredEnv(testInfo, 'E2E_CLOSABLE_ISSUE_URL');

  await signIn(page, editor);
  await page.goto(issueUrl);
  await page.getByRole('button', { name: /close issue|关闭议题/i }).click();
  await expect(page.getByText(/closed|已关闭/i)).toBeVisible();
  await expect(page.getByText(/closed.*issue|关闭.*议题/i)).toBeVisible();
  await page.getByRole('button', { name: /reopen issue|重新打开议题/i }).click();
  await expect(page.getByText(/open|打开/i)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /close issue|关闭议题/i })).toBeVisible();
});

test('REQ-5-4：没有议题管理权限的用户不能关闭或重新打开议题', async ({ page }, testInfo) => {
  const viewer = verifiedAccount(testInfo, 'E2E_ISSUE_VIEWER');
  const issueUrl = requiredEnv(testInfo, 'E2E_PROTECTED_ISSUE_URL');

  await signIn(page, viewer);
  await page.goto(issueUrl);
  await expect(page.getByRole('button', { name: /close issue|关闭议题/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /reopen issue|重新打开议题/i })).toHaveCount(0);
});
