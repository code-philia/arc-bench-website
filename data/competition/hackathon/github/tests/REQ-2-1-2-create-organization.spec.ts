import { expect, test } from '@playwright/test';
import { signIn, uniqueAccount, verifiedAccount } from './support/e2e';

test('REQ-2-1-2：已登录用户创建唯一组织后可重新打开其概览', async ({ page }, testInfo) => {
  const owner = verifiedAccount(testInfo, 'E2E_ORGANIZATION_OWNER');
  const suffix = uniqueAccount().username.replace('pw-user-', '');
  const organizationName = `pw-org-${suffix}`;

  await signIn(page, owner);
  await page.getByRole('button', { name: /account menu|账户菜单/i }).click();
  await page.getByRole('link', { name: /your organizations|你的组织/i }).click();
  await page.getByRole('link', { name: /new organization|创建组织/i }).click();
  await page.getByLabel(/organization name|组织名称/i).fill(organizationName);
  const displayName = page.getByLabel(/display name|显示名称/i);
  if (await displayName.isVisible()) await displayName.fill(`Playwright ${suffix}`);
  await page.getByRole('button', { name: /create organization|创建组织/i }).click();

  await expect(page.getByRole('heading', { name: new RegExp(organizationName, 'i') })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(organizationName, 'i') })).toBeVisible();
});

test('REQ-2-1-2：重复组织名不会创建新的组织', async ({ page }, testInfo) => {
  const owner = verifiedAccount(testInfo, 'E2E_ORGANIZATION_OWNER');
  const existingOrganization = process.env.E2E_EXISTING_ORGANIZATION;
  testInfo.skip(!existingOrganization, 'Set E2E_EXISTING_ORGANIZATION to an existing organization name.');

  await signIn(page, owner);
  await page.getByRole('button', { name: /account menu|账户菜单/i }).click();
  await page.getByRole('link', { name: /your organizations|你的组织/i }).click();
  await page.getByRole('link', { name: /new organization|创建组织/i }).click();
  await page.getByLabel(/organization name|组织名称/i).fill(existingOrganization!);
  await page.getByRole('button', { name: /create organization|创建组织/i }).click();

  await expect(page.getByText(/name.*(already|unavailable|exists)|组织.*(已存在|不可用)/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(existingOrganization!, 'i') })).not.toBeVisible();
});

test('REQ-2-1-2：不合规组织名或空显示名会被拒绝且不创建组织', async ({ page }, testInfo) => {
  const owner = verifiedAccount(testInfo, 'E2E_ORGANIZATION_OWNER');
  await signIn(page, owner);
  await page.getByRole('button', { name: /account menu|账户菜单/i }).click();
  await page.getByRole('link', { name: /your organizations|你的组织/i }).click();
  await page.getByRole('link', { name: /new organization|创建组织/i }).click();
  await page.getByLabel(/organization name|组织名称/i).fill('-invalid-organization');
  const displayName = page.getByLabel(/display name|显示名称/i);
  if (await displayName.isVisible()) await displayName.fill('   ');
  await page.getByRole('button', { name: /create organization|创建组织/i }).click();
  await expect(page.getByText(/name.*(invalid|format)|名称.*(无效|格式)|display.*required|显示名称.*必填/i)).toBeVisible();
});
