import { expect, test } from '@playwright/test';
import { baseUrl, requiredEnv } from './support/e2e';

test('REQ-3-1：访客搜索可见仓库并从结果打开仓库概览', async ({ page }, testInfo) => {
  const repositoryName = requiredEnv(testInfo, 'E2E_PUBLIC_REPOSITORY_NAME');

  await page.goto(baseUrl());
  await page.getByRole('searchbox', { name: /search|搜索/i }).fill(repositoryName);
  await page.getByRole('searchbox', { name: /search|搜索/i }).press('Enter');
  await page.getByRole('link', { name: repositoryName, exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(repositoryName, 'i') })).toBeVisible();
});

test('REQ-3-1：访客搜索时不会得到无权访问的私有仓库结果', async ({ page }, testInfo) => {
  const privateRepositoryName = requiredEnv(testInfo, 'E2E_PRIVATE_REPOSITORY_NAME');

  await page.goto(baseUrl());
  await page.getByRole('searchbox', { name: /search|搜索/i }).fill(privateRepositoryName);
  await page.getByRole('searchbox', { name: /search|搜索/i }).press('Enter');

  await expect(page.getByRole('link', { name: privateRepositoryName, exact: true })).not.toBeVisible();
});

test('REQ-3-1：无匹配搜索显示空结果而不会展示无关仓库', async ({ page }) => {
  const query = `no-repository-${Date.now()}`;
  await page.goto(baseUrl());
  await page.getByRole('searchbox', { name: /search|搜索/i }).fill(query);
  await page.getByRole('searchbox', { name: /search|搜索/i }).press('Enter');
  await expect(page.getByText(/no repositories|no results|没有.*仓库|无结果/i)).toBeVisible();
});

test('REQ-3-1：公开仓库搜索结果在刷新后仍然可见', async ({ page }, testInfo) => {
  const repositoryName = requiredEnv(testInfo, 'E2E_PUBLIC_REPOSITORY_NAME');

  await page.goto(baseUrl());
  await page.getByRole('searchbox', { name: /search|搜索/i }).fill(repositoryName);
  await page.getByRole('searchbox', { name: /search|搜索/i }).press('Enter');
  await page.getByRole('link', { name: repositoryName, exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(repositoryName, 'i') })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(repositoryName, 'i') })).toBeVisible();
});

test('REQ-3-1：无匹配搜索在返回首页并重新搜索后仍显示空结果', async ({ page }) => {
  const query = `missing-repository-${Date.now()}`;

  await page.goto(baseUrl());
  await page.getByRole('searchbox', { name: /search|搜索/i }).fill(query);
  await page.getByRole('searchbox', { name: /search|搜索/i }).press('Enter');
  await expect(page.getByText(/no repositories|no results|没有.*仓库|无结果/i)).toBeVisible();

  await page.goto(baseUrl());
  await page.getByRole('searchbox', { name: /search|搜索/i }).fill(query);
  await page.getByRole('searchbox', { name: /search|搜索/i }).press('Enter');
  await expect(page.getByText(/no repositories|no results|没有.*仓库|无结果/i)).toBeVisible();
});
