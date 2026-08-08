import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, uniqueAccount, verifiedAccount } from './support/e2e';

test('REQ-6-2-4：协作者创建草稿拉取请求后显示 Draft 且不可合并', async ({ page }, testInfo) => {
  const contributor = verifiedAccount(testInfo, 'E2E_PR_CONTRIBUTOR');
  const compareUrl = requiredEnv(testInfo, 'E2E_DRAFT_COMPARE_URL');
  const title = `Playwright draft ${uniqueAccount().username.slice(-10)}`;

  await signIn(page, contributor);
  await page.goto(compareUrl);
  await page.getByRole('button', { name: /create draft pull request|创建草稿拉取请求/i }).click();
  await page.getByLabel(/title|标题/i).fill(title);
  await page.getByRole('button', { name: /create draft pull request|创建草稿拉取请求/i }).click();
  await expect(page.getByText(/draft|草稿/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /merge pull request|合并拉取请求/i })).toBeDisabled();
});
