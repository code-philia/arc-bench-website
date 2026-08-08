import { expect, test } from '@playwright/test';
import { requiredEnv } from './support/e2e';

test('REQ-2-1-1：访客可筛选公共组织仓库并进入所选仓库概览', async ({ page }, testInfo) => {
  const organizationUrl = requiredEnv(testInfo, 'E2E_PUBLIC_ORGANIZATION_URL');
  const repositoryName = requiredEnv(testInfo, 'E2E_PUBLIC_ORGANIZATION_REPOSITORY');

  await page.goto(organizationUrl);
  await page.getByRole('link', { name: /repositories|仓库/i }).click();
  await page.getByRole('textbox', { name: /find a repository|filter.*repositories|筛选.*仓库/i }).fill(repositoryName);
  await page.getByRole('link', { name: repositoryName, exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(repositoryName, 'i') })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link', { name: repositoryName, exact: true })).toBeVisible();
});

test('REQ-2-1-1：访客不会在公共组织仓库列表中看到私有仓库', async ({ page }, testInfo) => {
  const organizationUrl = requiredEnv(testInfo, 'E2E_PUBLIC_ORGANIZATION_URL');
  const privateRepositoryName = requiredEnv(testInfo, 'E2E_PRIVATE_ORGANIZATION_REPOSITORY');

  await page.goto(organizationUrl);
  await page.getByRole('link', { name: /repositories|仓库/i }).click();
  await page.getByRole('textbox', { name: /find a repository|filter.*repositories|筛选.*仓库/i }).fill(privateRepositoryName);

  await expect(page.getByRole('link', { name: privateRepositoryName, exact: true })).not.toBeVisible();
});
