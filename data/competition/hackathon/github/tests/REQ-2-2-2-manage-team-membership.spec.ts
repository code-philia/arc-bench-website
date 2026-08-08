import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-2-2-2：团队维护者添加并移除成员，成员列表会同步更新', async ({ page }, testInfo) => {
  const maintainer = verifiedAccount(testInfo, 'E2E_TEAM_MAINTAINER');
  const teamUrl = requiredEnv(testInfo, 'E2E_TEAM_URL');
  const member = requiredEnv(testInfo, 'E2E_TEAM_CANDIDATE_USERNAME');

  await signIn(page, maintainer);
  await page.goto(teamUrl);
  await page.getByRole('link', { name: /members|成员/i }).click();
  await page.getByRole('button', { name: /add member|添加成员/i }).click();
  await page.getByRole('textbox', { name: /username|member|用户名|成员/i }).fill(member);
  await page.getByRole('button', { name: /add.*member|添加.*成员/i }).click();
  await expect(page.getByText(member, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: new RegExp(`remove.*${member}|移除.*${member}`, 'i') }).click();
  await expect(page.getByText(member, { exact: true })).not.toBeVisible();
  await page.reload();
  await expect(page.getByText(member, { exact: true })).not.toBeVisible();
});

test('REQ-2-2-2：不能把团队的后代团队设为父团队形成循环层级', async ({ page }, testInfo) => {
  const maintainer = verifiedAccount(testInfo, 'E2E_TEAM_MAINTAINER');
  const teamUrl = requiredEnv(testInfo, 'E2E_CYCLIC_TEAM_URL');
  const descendantTeam = requiredEnv(testInfo, 'E2E_CYCLIC_TEAM_DESCENDANT');
  const originalParent = requiredEnv(testInfo, 'E2E_CYCLIC_TEAM_ORIGINAL_PARENT');

  await signIn(page, maintainer);
  await page.goto(teamUrl);
  await page.getByRole('link', { name: /settings|设置/i }).click();
  await page.getByRole('combobox', { name: /parent team|父团队/i }).selectOption({
    label: descendantTeam,
  });
  await page.getByRole('button', { name: /save|update|保存|更新/i }).click();

  await expect(page.getByText(/cycle|cyclic|循环/i)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox', { name: /parent team|父团队/i })).toHaveValue(
    originalParent,
  );
});
