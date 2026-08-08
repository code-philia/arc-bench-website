import { expect, test } from '@playwright/test';
import { requiredEnv } from './support/e2e';

test('REQ-6-2-1：用户按打开状态筛选拉取请求并打开目标提案', async ({ page }, testInfo) => {
  const pullsUrl = requiredEnv(testInfo, 'E2E_PULL_REQUESTS_URL');
  const title = requiredEnv(testInfo, 'E2E_OPEN_PULL_REQUEST_TITLE');

  await page.goto(pullsUrl);
  await page.getByRole('link', { name: /open|打开/i }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
  await page.getByRole('link', { name: title, exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-2-1：打开状态筛选在刷新后仍保持相同提案可见', async ({ page }, testInfo) => {
  const pullsUrl = requiredEnv(testInfo, 'E2E_PULL_REQUESTS_URL');
  const title = requiredEnv(testInfo, 'E2E_OPEN_PULL_REQUEST_TITLE');

  await page.goto(pullsUrl);
  await page.getByRole('link', { name: /open|打开/i }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-2-1：离开后重新进入拉取请求列表仍能找到打开状态提案', async ({
  page,
}, testInfo) => {
  const pullsUrl = requiredEnv(testInfo, 'E2E_PULL_REQUESTS_URL');
  const title = requiredEnv(testInfo, 'E2E_OPEN_PULL_REQUEST_TITLE');

  await page.goto(pullsUrl);
  await page.getByRole('link', { name: /open|打开/i }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
  await page.goto('about:blank');
  await page.goto(pullsUrl);
  await page.getByRole('link', { name: /open|打开/i }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});
