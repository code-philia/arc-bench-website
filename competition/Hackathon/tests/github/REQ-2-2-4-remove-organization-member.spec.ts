import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-2-2-4：组织所有者移除成员后，该成员不再出现在组织人员列表', async ({ page }, testInfo) => {
  const owner = verifiedAccount(testInfo, 'E2E_ORGANIZATION_OWNER');
  const organizationUrl = requiredEnv(testInfo, 'E2E_ORGANIZATION_URL');
  const member = requiredEnv(testInfo, 'E2E_ORGANIZATION_MEMBER_TO_REMOVE');

  await signIn(page, owner);
  await page.goto(organizationUrl);
  await page.getByRole('link', { name: /people|人员|成员/i }).click();
  await expect(page.getByText(member, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`.*${member}.*(menu|操作)|.*(menu|操作).*${member}`, 'i') }).click();
  await page.getByRole('menuitem', { name: /remove from organization|从组织移除/i }).click();
  await page.getByRole('button', { name: /^remove$|确认移除/i }).click();

  await expect(page.getByText(member, { exact: true })).not.toBeVisible();
  await page.reload();
  await expect(page.getByText(member, { exact: true })).not.toBeVisible();
});

test('REQ-2-2-4：非组织所有者不能移除其他组织成员', async ({ page }, testInfo) => {
  const nonOwner = verifiedAccount(testInfo, 'E2E_ORGANIZATION_NON_OWNER');
  const organizationUrl = requiredEnv(testInfo, 'E2E_ORGANIZATION_URL');
  const member = requiredEnv(testInfo, 'E2E_ORGANIZATION_MEMBER_TO_REMOVE');

  await signIn(page, nonOwner);
  await page.goto(organizationUrl);
  await page.getByRole('link', { name: /people|人员|成员/i }).click();
  await expect(page.getByText(member, { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: new RegExp(`.*${member}.*(menu|操作)|.*(menu|操作).*${member}`, 'i'),
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('menuitem', { name: /remove from organization|从组织移除/i }),
  ).toHaveCount(0);
});
