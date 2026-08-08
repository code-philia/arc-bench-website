import { expect, test } from '@playwright/test';
import { requiredEnv } from './support/e2e';

test('REQ-5-1-2：用户打开议题详情可查看标题、描述、状态和讨论', async ({ page }, testInfo) => {
  const issueUrl = requiredEnv(testInfo, 'E2E_ISSUE_URL');
  const title = requiredEnv(testInfo, 'E2E_ISSUE_TITLE');
  const description = requiredEnv(testInfo, 'E2E_ISSUE_DESCRIPTION');

  await page.goto(issueUrl);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  await expect(page.getByText(/open|closed|打开|已关闭/i)).toBeVisible();
  await expect(page.getByText(/comment|activity|评论|活动/i)).toBeVisible();
});

test('REQ-5-1-2：议题详情在刷新后仍保持标题和描述可见', async ({ page }, testInfo) => {
  const issueUrl = requiredEnv(testInfo, 'E2E_ISSUE_URL');
  const title = requiredEnv(testInfo, 'E2E_ISSUE_TITLE');
  const description = requiredEnv(testInfo, 'E2E_ISSUE_DESCRIPTION');

  await page.goto(issueUrl);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
});

test('REQ-5-1-2：离开后重新打开议题仍显示同一详情', async ({ page }, testInfo) => {
  const issueUrl = requiredEnv(testInfo, 'E2E_ISSUE_URL');
  const title = requiredEnv(testInfo, 'E2E_ISSUE_TITLE');

  await page.goto(issueUrl);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.goto('about:blank');
  await page.goto(issueUrl);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(/open|closed|打开|已关闭/i)).toBeVisible();
});
