import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, uniqueAccount, verifiedAccount } from './support/e2e';

test('REQ-5-2-2：有编辑权限的用户保存新标题和描述，重新打开后仍显示新值', async ({ page }, testInfo) => {
  const editor = verifiedAccount(testInfo, 'E2E_ISSUE_EDITOR');
  const issueUrl = requiredEnv(testInfo, 'E2E_EDITABLE_ISSUE_URL');
  const title = `Edited issue ${uniqueAccount().username.slice(-10)}`;
  const body = `Edited description ${Date.now()}`;

  await signIn(page, editor);
  await page.goto(issueUrl);
  await page.getByRole('button', { name: /edit title|编辑标题|edit/i }).first().click();
  await page.getByLabel(/title|标题/i).fill(title);
  await page.getByRole('button', { name: /save|保存/i }).click();
  await page.getByRole('button', { name: /edit.*(description|comment)|编辑.*(描述|内容)/i }).click();
  await page.getByLabel(/description|comment|描述/i).fill(body);
  await page.getByRole('button', { name: /save|保存/i }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
});

test('REQ-5-2-2：空白标题保存失败且重新打开后仍保留原标题', async ({ page }, testInfo) => {
  const editor = verifiedAccount(testInfo, 'E2E_ISSUE_EDITOR');
  const issueUrl = requiredEnv(testInfo, 'E2E_INVALID_EDIT_ISSUE_URL');
  const originalTitle = requiredEnv(testInfo, 'E2E_INVALID_EDIT_ISSUE_TITLE');

  await signIn(page, editor);
  await page.goto(issueUrl);
  await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible();
  await page.getByRole('button', { name: /edit title|编辑标题|edit/i }).first().click();
  await page.getByLabel(/title|标题/i).fill('   ');
  await page.getByRole('button', { name: /save|保存/i }).click();

  await expect(page.getByText(/title.*required|title.*empty|标题.*必填|标题.*为空/i)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible();
});
