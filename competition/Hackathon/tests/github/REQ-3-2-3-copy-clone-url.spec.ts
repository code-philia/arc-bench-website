import { expect, test } from '@playwright/test';
import { requiredEnv } from './support/e2e';

test('REQ-3-2-3：访客复制 HTTPS 克隆地址时得到可粘贴 URL 且仓库内容不变', async ({ page }, testInfo) => {
  const repositoryUrl = requiredEnv(testInfo, 'E2E_PUBLIC_REPOSITORY_URL');
  const repositoryName = requiredEnv(testInfo, 'E2E_PUBLIC_REPOSITORY_NAME');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(repositoryUrl).origin });

  await page.goto(repositoryUrl);
  await page.getByRole('button', { name: /code|代码/i }).click();
  await page.getByRole('tab', { name: /https/i }).click();
  await page.getByRole('button', { name: /copy.*clone|复制.*克隆|copy/i }).click();

  await expect(page.getByText(/copied|已复制/i)).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/^https?:\/\//);
  await expect(page.getByRole('heading', { name: new RegExp(repositoryName, 'i') })).toBeVisible();
});

test('REQ-3-2-3：用户选择 SSH 时复制 SSH 克隆地址', async ({ page }, testInfo) => {
  const repositoryUrl = requiredEnv(testInfo, 'E2E_PUBLIC_REPOSITORY_URL');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(repositoryUrl).origin });
  await page.goto(repositoryUrl);
  await page.getByRole('button', { name: /code|代码/i }).click();
  await page.getByRole('tab', { name: /ssh/i }).click();
  await page.getByRole('button', { name: /copy.*clone|复制.*克隆|copy/i }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/^[\w-]+@.+:.+\.git$/);
});
