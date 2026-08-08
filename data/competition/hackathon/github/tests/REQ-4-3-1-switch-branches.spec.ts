import { expect, test } from '@playwright/test';
import { requiredEnv } from './support/e2e';

test('REQ-4-3-1：用户从分支选择器切换分支，浏览上下文随之变化', async ({ page }, testInfo) => {
  const repositoryUrl = requiredEnv(testInfo, 'E2E_BRANCH_REPOSITORY_URL');
  const targetBranch = requiredEnv(testInfo, 'E2E_TARGET_BRANCH');
  const branchOnlyFile = requiredEnv(testInfo, 'E2E_TARGET_BRANCH_FILE');

  await page.goto(repositoryUrl);
  await page.getByRole('button', { name: /branch|分支/i }).click();
  await page.getByRole('textbox', { name: /find.*branch|搜索.*分支/i }).fill(targetBranch);
  await page.getByRole('option', { name: targetBranch, exact: true }).click();
  await expect(page.getByRole('button', { name: new RegExp(targetBranch, 'i') })).toBeVisible();
  await expect(page.getByRole('link', { name: branchOnlyFile, exact: true })).toBeVisible();
});

test('REQ-4-3-1：分支搜索无匹配项时保持当前活动分支不变', async ({ page }, testInfo) => {
  const repositoryUrl = requiredEnv(testInfo, 'E2E_BRANCH_REPOSITORY_URL');
  const activeBranch = requiredEnv(testInfo, 'E2E_ACTIVE_BRANCH');
  const unknownBranch = requiredEnv(testInfo, 'E2E_UNKNOWN_BRANCH_QUERY');

  await page.goto(repositoryUrl);
  await expect(page.getByRole('button', { name: new RegExp(activeBranch, 'i') })).toBeVisible();
  await page.getByRole('button', { name: /branch|分支/i }).click();
  await page.getByRole('textbox', { name: /find.*branch|搜索.*分支/i }).fill(unknownBranch);
  await expect(page.getByText(/no.*branch|没有.*分支|无匹配/i)).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('button', { name: new RegExp(activeBranch, 'i') })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: new RegExp(activeBranch, 'i') })).toBeVisible();
});
