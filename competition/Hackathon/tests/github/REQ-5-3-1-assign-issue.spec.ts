import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-5-3-1：用户分配并取消分配可用成员，议题元数据会同步更新', async ({ page }, testInfo) => {
  const editor = verifiedAccount(testInfo, 'E2E_ISSUE_EDITOR');
  const issueUrl = requiredEnv(testInfo, 'E2E_ASSIGNABLE_ISSUE_URL');
  const assignee = requiredEnv(testInfo, 'E2E_ISSUE_ASSIGNEE');

  await signIn(page, editor);
  await page.goto(issueUrl);
  await page.getByRole('button', { name: /assignees|受理人|负责人/i }).click();
  await page.getByRole('textbox', { name: /search|搜索/i }).fill(assignee);
  await page.getByRole('option', { name: assignee, exact: true }).click();
  await expect(page.getByText(assignee, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(assignee, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /assignees|受理人|负责人/i }).click();
  await page.getByRole('option', { name: assignee, exact: true }).click();
  await expect(page.getByText(assignee, { exact: true })).not.toBeVisible();
});
