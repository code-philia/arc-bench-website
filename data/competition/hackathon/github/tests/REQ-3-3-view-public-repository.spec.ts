import { expect, test } from '@playwright/test';
import { requiredEnv } from './support/e2e';

test('REQ-3-3：访客打开公共仓库概览可查看身份、可见性和内容入口', async ({ page }, testInfo) => {
  const repositoryUrl = requiredEnv(testInfo, 'E2E_PUBLIC_REPOSITORY_URL');
  const repositoryName = requiredEnv(testInfo, 'E2E_PUBLIC_REPOSITORY_NAME');

  await page.goto(repositoryUrl);
  await expect(page.getByRole('heading', { name: new RegExp(repositoryName, 'i') })).toBeVisible();
  await expect(page.getByText(/public|公开/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /code|代码/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(repositoryName, 'i') })).toBeVisible();
});
