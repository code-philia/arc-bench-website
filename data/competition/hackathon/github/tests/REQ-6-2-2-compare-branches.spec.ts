import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-6-2-2：协作者比较两个不同分支后可查看提交数、文件和差异摘要', async ({ page }, testInfo) => {
  const contributor = verifiedAccount(testInfo, 'E2E_PR_CONTRIBUTOR');
  const pullsUrl = requiredEnv(testInfo, 'E2E_PULL_REQUESTS_URL');
  const base = requiredEnv(testInfo, 'E2E_PR_BASE_BRANCH');
  const compare = requiredEnv(testInfo, 'E2E_PR_COMPARE_BRANCH');
  const changedFile = requiredEnv(testInfo, 'E2E_PR_CHANGED_FILE');

  await signIn(page, contributor);
  await page.goto(pullsUrl);
  await page.getByRole('link', { name: /new pull request|新建拉取请求/i }).click();
  await page.getByRole('combobox', { name: /base|基础/i }).selectOption({ label: base });
  await page.getByRole('combobox', { name: /compare|比较/i }).selectOption({ label: compare });
  await page.getByRole('button', { name: /compare changes|比较更改/i }).click();
  await expect(page.getByText(changedFile, { exact: true })).toBeVisible();
  await expect(page.getByText(/commit|提交/i)).toBeVisible();
});

test('REQ-6-2-2：基础分支和比较分支相同时不能创建拉取请求', async ({ page }, testInfo) => {
  const contributor = verifiedAccount(testInfo, 'E2E_PR_CONTRIBUTOR');
  const pullsUrl = requiredEnv(testInfo, 'E2E_PULL_REQUESTS_URL');
  const branch = requiredEnv(testInfo, 'E2E_PR_BASE_BRANCH');

  await signIn(page, contributor);
  await page.goto(pullsUrl);
  await page.getByRole('link', { name: /new pull request|新建拉取请求/i }).click();
  await page.getByRole('combobox', { name: /base|基础/i }).selectOption({ label: branch });
  await page.getByRole('combobox', { name: /compare|比较/i }).selectOption({ label: branch });

  await expect(page.getByText(/identical|no changes|没有差异|相同分支/i)).toBeVisible();
  const createButton = page.getByRole('button', {
    name: /create pull request|创建拉取请求/i,
  });
  if ((await createButton.count()) > 0) {
    await expect(createButton).toBeDisabled();
  }
});
