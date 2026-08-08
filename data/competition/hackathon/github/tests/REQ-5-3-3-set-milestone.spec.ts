import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-5-3-3：用户将议题归入当前仓库里程碑，关联在重新打开后仍存在', async ({ page }, testInfo) => {
  const collaborator = verifiedAccount(testInfo, 'E2E_ISSUE_EDITOR');
  const issueUrl = requiredEnv(testInfo, 'E2E_MILESTONE_ISSUE_URL');
  const milestone = requiredEnv(testInfo, 'E2E_ISSUE_MILESTONE');

  await signIn(page, collaborator);
  await page.goto(issueUrl);
  await page.getByRole('button', { name: /milestone|里程碑/i }).click();
  await page.getByRole('option', { name: milestone, exact: true }).click();
  await expect(page.getByText(milestone, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(milestone, { exact: true })).toBeVisible();
});
