import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, uniqueAccount, verifiedAccount } from './support/e2e';

test('REQ-2-2-1：组织所有者创建团队后，团队归属在重新打开后保持', async ({ page }, testInfo) => {
  const owner = verifiedAccount(testInfo, 'E2E_ORGANIZATION_OWNER');
  const organizationUrl = requiredEnv(testInfo, 'E2E_ORGANIZATION_URL');
  const teamName = `pw-team-${uniqueAccount().username.slice(-12)}`;

  await signIn(page, owner);
  await page.goto(organizationUrl);
  await page.getByRole('link', { name: /teams|团队/i }).click();
  await page.getByRole('link', { name: /new team|新建团队/i }).click();
  await page.getByLabel(/team name|团队名称/i).fill(teamName);
  await page.getByRole('button', { name: /create team|创建团队/i }).click();

  await expect(page.getByRole('heading', { name: new RegExp(teamName, 'i') })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(teamName, 'i') })).toBeVisible();
});

test('REQ-2-2-1：不合规或重复团队名不生成团队', async ({ page }, testInfo) => {
  const owner = verifiedAccount(testInfo, 'E2E_ORGANIZATION_OWNER');
  const organizationUrl = requiredEnv(testInfo, 'E2E_ORGANIZATION_URL');
  await signIn(page, owner);
  await page.goto(organizationUrl);
  await page.getByRole('link', { name: /teams|团队/i }).click();
  await page.getByRole('link', { name: /new team|新建团队/i }).click();
  await page.getByLabel(/team name|团队名称/i).fill('-invalid-team');
  await page.getByRole('button', { name: /create team|创建团队/i }).click();
  await expect(page.getByText(/team.*(invalid|format)|团队.*(无效|格式)/i)).toBeVisible();
});
