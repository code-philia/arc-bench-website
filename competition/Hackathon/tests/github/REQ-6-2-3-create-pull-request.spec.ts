import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, uniqueAccount, verifiedAccount } from './support/e2e';

test('REQ-6-2-3：协作者基于有效比较创建打开状态的拉取请求', async ({ page }, testInfo) => {
  const contributor = verifiedAccount(testInfo, 'E2E_PR_CONTRIBUTOR');
  const compareUrl = requiredEnv(testInfo, 'E2E_VALID_COMPARE_URL');
  const title = `Playwright PR ${uniqueAccount().username.slice(-10)}`;

  await signIn(page, contributor);
  await page.goto(compareUrl);
  await page.getByRole('button', { name: /create pull request|创建拉取请求/i }).click();
  await page.getByLabel(/title|标题/i).fill(title);
  await page.getByRole('button', { name: /create pull request|创建拉取请求/i }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(/open|打开/i)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-2-3：空白标题不会从比较结果创建拉取请求', async ({ page }, testInfo) => {
  const contributor = verifiedAccount(testInfo, 'E2E_PR_CONTRIBUTOR');
  const compareUrl = requiredEnv(testInfo, 'E2E_VALID_COMPARE_URL');
  await signIn(page, contributor);
  await page.goto(compareUrl);
  await page.getByRole('button', { name: /create pull request|创建拉取请求/i }).click();
  await page.getByLabel(/title|标题/i).fill('   ');
  await page.getByRole('button', { name: /create pull request|创建拉取请求/i }).click();
  await expect(page.getByText(/title.*required|标题.*必填/i)).toBeVisible();
});
