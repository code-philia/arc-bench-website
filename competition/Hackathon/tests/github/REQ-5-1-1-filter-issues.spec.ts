import { expect, test } from '@playwright/test';
import { requiredEnv } from './support/e2e';

test('REQ-5-1-1：用户按状态和关键词筛选议题，筛选不改变原议题', async ({ page }, testInfo) => {
  const issuesUrl = requiredEnv(testInfo, 'E2E_ISSUES_URL');
  const openTitle = requiredEnv(testInfo, 'E2E_OPEN_ISSUE_TITLE');

  await page.goto(issuesUrl);
  await page.getByRole('link', { name: /open|打开/i }).click();
  await page.getByRole('searchbox', { name: /search|filter|搜索|筛选/i }).fill(openTitle);
  await expect(page.getByRole('link', { name: openTitle, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: openTitle, exact: true })).toBeVisible();
});

test('REQ-5-1-1：按关闭状态筛选时只显示匹配的已关闭议题', async ({ page }, testInfo) => {
  const issuesUrl = requiredEnv(testInfo, 'E2E_ISSUES_URL');
  const closedTitle = requiredEnv(testInfo, 'E2E_CLOSED_ISSUE_TITLE');
  const openTitle = requiredEnv(testInfo, 'E2E_OPEN_ISSUE_TITLE');

  await page.goto(issuesUrl);
  await page.getByRole('link', { name: /closed|已关闭/i }).click();
  await page.getByRole('searchbox', { name: /search|filter|搜索|筛选/i }).fill(closedTitle);

  await expect(page.getByRole('link', { name: closedTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: openTitle, exact: true })).not.toBeVisible();
});
