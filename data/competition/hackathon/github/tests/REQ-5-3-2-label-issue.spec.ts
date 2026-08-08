import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-5-3-2：用户为议题应用当前仓库标签，重新打开后标签仍可见', async ({ page }, testInfo) => {
  const editor = verifiedAccount(testInfo, 'E2E_ISSUE_EDITOR');
  const issueUrl = requiredEnv(testInfo, 'E2E_LABELABLE_ISSUE_URL');
  const label = requiredEnv(testInfo, 'E2E_ISSUE_LABEL');

  await signIn(page, editor);
  await page.goto(issueUrl);
  await page.getByRole('button', { name: /labels|标签/i }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await expect(page.getByText(label, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(label, { exact: true })).toBeVisible();
});
