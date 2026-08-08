import { expect, test } from '@playwright/test';
import { requiredEnv } from './support/e2e';

test('REQ-6-3-1：评审者可在拉取请求查看概览、提交和变更文件上下文', async ({ page }, testInfo) => {
  const pullRequestUrl = requiredEnv(testInfo, 'E2E_PULL_REQUEST_URL');
  const title = requiredEnv(testInfo, 'E2E_PULL_REQUEST_TITLE');

  await page.goto(pullRequestUrl);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('link', { name: /commits|提交/i }).click();
  await expect(page.getByText(/commit|提交/i)).toBeVisible();
  await page.getByRole('link', { name: /files changed|已更改文件/i }).click();
  await expect(page.getByText(/changed files|已更改文件/i)).toBeVisible();
});

test('REQ-6-3-1：拉取请求详情在刷新后仍保留标题和标签页入口', async ({ page }, testInfo) => {
  const pullRequestUrl = requiredEnv(testInfo, 'E2E_PULL_REQUEST_URL');
  const title = requiredEnv(testInfo, 'E2E_PULL_REQUEST_TITLE');

  await page.goto(pullRequestUrl);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('link', { name: /commits|提交/i }).click();
  await expect(page.getByText(/commit|提交/i)).toBeVisible();
});

test('REQ-6-3-1：离开后重新打开同一拉取请求仍能查看概览和变更文件', async ({
  page,
}, testInfo) => {
  const pullRequestUrl = requiredEnv(testInfo, 'E2E_PULL_REQUEST_URL');
  const title = requiredEnv(testInfo, 'E2E_PULL_REQUEST_TITLE');

  await page.goto(pullRequestUrl);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.goto('about:blank');
  await page.goto(pullRequestUrl);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('link', { name: /files changed|已更改文件/i }).click();
  await expect(page.getByText(/changed files|已更改文件/i)).toBeVisible();
});
