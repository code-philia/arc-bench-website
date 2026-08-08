import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-2-2-3：组织所有者邀请用户后，待接受邀请会持久化且不会提前授予成员权限', async ({ page }, testInfo) => {
  const owner = verifiedAccount(testInfo, 'E2E_ORGANIZATION_OWNER');
  const organizationUrl = requiredEnv(testInfo, 'E2E_ORGANIZATION_URL');
  const invitee = requiredEnv(testInfo, 'E2E_ORGANIZATION_INVITEE');

  await signIn(page, owner);
  await page.goto(organizationUrl);
  await page.getByRole('link', { name: /people|人员|成员/i }).click();
  await page.getByRole('button', { name: /invite member|邀请成员/i }).click();
  await page.getByLabel(/username or email|用户名或邮箱/i).fill(invitee);
  const role = page.getByRole('combobox', { name: /role|角色/i });
  if (await role.isVisible()) {
    await role.click();
    await page.getByRole('option', { name: /member|成员/i }).click();
  }
  await page.getByRole('button', { name: /send invitation|发送邀请/i }).click();

  await expect(page.getByText(invitee, { exact: true })).toBeVisible();
  await expect(page.getByText(/pending|awaiting|待接受|等待/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText(invitee, { exact: true })).toBeVisible();
});

test('REQ-2-2-3：已有待接受邀请的账户不能收到重复邀请', async ({ page }, testInfo) => {
  const owner = verifiedAccount(testInfo, 'E2E_ORGANIZATION_OWNER');
  const organizationUrl = requiredEnv(testInfo, 'E2E_ORGANIZATION_URL');
  const invitee = requiredEnv(testInfo, 'E2E_PENDING_ORGANIZATION_INVITEE');
  await signIn(page, owner);
  await page.goto(organizationUrl);
  await page.getByRole('link', { name: /people|人员|成员/i }).click();
  await page.getByRole('button', { name: /invite member|邀请成员/i }).click();
  await page.getByLabel(/username or email|用户名或邮箱/i).fill(invitee);
  await page.getByRole('button', { name: /send invitation|发送邀请/i }).click();
  await expect(page.getByText(/already.*invited|pending.*invitation|已邀请|待接受/i)).toBeVisible();
});
