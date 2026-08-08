import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, uniqueAccount, verifiedAccount } from './support/e2e';

test('REQ-5-2-1：已登录用户创建非空议题后，详情和列表均可找到该议题', async ({ page }, testInfo) => {
  const author = verifiedAccount(testInfo, 'E2E_ISSUE_AUTHOR');
  const issuesUrl = requiredEnv(testInfo, 'E2E_ISSUES_URL');
  const title = `Playwright issue ${uniqueAccount().username.slice(-10)}`;
  const body = `Issue body ${Date.now()}`;

  await signIn(page, author);
  await page.goto(issuesUrl);
  await page.getByRole('link', { name: /new issue|新建议题/i }).click();
  await page.getByLabel(/title|标题/i).fill(title);
  await page.getByLabel(/comment|description|描述/i).fill(body);
  await page.getByRole('button', { name: /submit new issue|提交新议题/i }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
  await page.goto(issuesUrl);
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-2-1：空白标题不会创建议题', async ({ page }, testInfo) => {
  const author = verifiedAccount(testInfo, 'E2E_ISSUE_AUTHOR');
  const issuesUrl = requiredEnv(testInfo, 'E2E_ISSUES_URL');
  await signIn(page, author);
  await page.goto(issuesUrl);
  await page.getByRole('link', { name: /new issue|新建议题/i }).click();
  await page.getByLabel(/title|标题/i).fill('   ');
  await page.getByRole('button', { name: /submit new issue|提交新议题/i }).click();
  await expect(page.getByText(/title.*required|标题.*必填/i)).toBeVisible();
});
