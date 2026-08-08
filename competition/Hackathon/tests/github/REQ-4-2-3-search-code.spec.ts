import { expect, test } from '@playwright/test';
import { requiredEnv } from './support/e2e';

test('REQ-4-2-3：用户在仓库范围搜索代码并打开匹配文件', async ({ page }, testInfo) => {
  const repositoryUrl = requiredEnv(testInfo, 'E2E_CODE_REPOSITORY_URL');
  const query = requiredEnv(testInfo, 'E2E_CODE_SEARCH_QUERY');
  const fileName = requiredEnv(testInfo, 'E2E_CODE_SEARCH_FILE');

  await page.goto(repositoryUrl);
  await page.getByRole('searchbox', { name: /search|搜索/i }).fill(query);
  await page.getByRole('searchbox', { name: /search|搜索/i }).press('Enter');
  await page.getByRole('link', { name: /code|代码/i }).click();
  await page.getByRole('link', { name: fileName, exact: true }).click();
  await expect(page.getByText(query, { exact: true })).toBeVisible();
});

test('REQ-4-2-3：仓库代码无匹配项时显示空结果且保持仓库搜索范围', async ({ page }, testInfo) => {
  const repositoryUrl = requiredEnv(testInfo, 'E2E_CODE_REPOSITORY_URL');
  const query = requiredEnv(testInfo, 'E2E_CODE_SEARCH_EMPTY_QUERY');

  await page.goto(repositoryUrl);
  await page.getByRole('searchbox', { name: /search|搜索/i }).fill(query);
  await page.getByRole('searchbox', { name: /search|搜索/i }).press('Enter');
  await page.getByRole('link', { name: /code|代码/i }).click();

  await expect(page.getByText(/no.*code.*results|no results|没有.*代码.*结果|无结果/i)).toBeVisible();
  await expect(page.getByRole('searchbox', { name: /search|搜索/i })).toHaveValue(query);
});

test('REQ-4-2-3：代码搜索结果在刷新后仍然保留当前文件上下文', async ({ page }, testInfo) => {
  const repositoryUrl = requiredEnv(testInfo, 'E2E_CODE_REPOSITORY_URL');
  const query = requiredEnv(testInfo, 'E2E_CODE_SEARCH_QUERY');
  const fileName = requiredEnv(testInfo, 'E2E_CODE_SEARCH_FILE');

  await page.goto(repositoryUrl);
  await page.getByRole('searchbox', { name: /search|搜索/i }).fill(query);
  await page.getByRole('searchbox', { name: /search|搜索/i }).press('Enter');
  await page.getByRole('link', { name: /code|代码/i }).click();
  await page.getByRole('link', { name: fileName, exact: true }).click();
  await expect(page.getByText(query, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(query, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: fileName, exact: true })).toBeVisible();
});

test('REQ-4-2-3：空代码搜索在返回代码页后仍保持空结果', async ({ page }, testInfo) => {
  const repositoryUrl = requiredEnv(testInfo, 'E2E_CODE_REPOSITORY_URL');
  const query = requiredEnv(testInfo, 'E2E_CODE_SEARCH_EMPTY_QUERY');

  await page.goto(repositoryUrl);
  await page.getByRole('searchbox', { name: /search|搜索/i }).fill(query);
  await page.getByRole('searchbox', { name: /search|搜索/i }).press('Enter');
  await page.getByRole('link', { name: /code|代码/i }).click();
  await expect(page.getByText(/no.*code.*results|no results|没有.*代码.*结果|无结果/i)).toBeVisible();

  await page.goto(repositoryUrl);
  await page.getByRole('searchbox', { name: /search|搜索/i }).fill(query);
  await page.getByRole('searchbox', { name: /search|搜索/i }).press('Enter');
  await page.getByRole('link', { name: /code|代码/i }).click();
  await expect(page.getByText(/no.*code.*results|no results|没有.*代码.*结果|无结果/i)).toBeVisible();
});
