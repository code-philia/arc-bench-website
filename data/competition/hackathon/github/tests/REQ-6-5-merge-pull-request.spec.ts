import { expect, test } from '@playwright/test';
import { requiredEnv, signIn, verifiedAccount } from './support/e2e';

test('REQ-6-5：维护者合并满足条件的拉取请求后，详情显示 merged 状态', async ({ page }, testInfo) => {
  const maintainer = verifiedAccount(testInfo, 'E2E_PR_MAINTAINER');
  const pullRequestUrl = requiredEnv(testInfo, 'E2E_MERGEABLE_PULL_REQUEST_URL');

  await signIn(page, maintainer);
  await page.goto(pullRequestUrl);
  await page.getByRole('button', { name: /merge pull request|合并拉取请求/i }).click();
  await page.getByRole('button', { name: /confirm merge|确认合并/i }).click();
  await expect(page.getByText(/merged|已合并/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/merged|已合并/i)).toBeVisible();
});

test('REQ-6-5：未满足评审或保护规则时不能合并拉取请求', async ({ page }, testInfo) => {
  const maintainer = verifiedAccount(testInfo, 'E2E_PR_MAINTAINER');
  const pullRequestUrl = requiredEnv(testInfo, 'E2E_UNMERGEABLE_PULL_REQUEST_URL');
  await signIn(page, maintainer);
  await page.goto(pullRequestUrl);
  const merge = page.getByRole('button', { name: /merge pull request|合并拉取请求/i });
  await expect(merge).toBeDisabled();
  await expect(page.getByText(/review|required|protection|评审|保护/i)).toBeVisible();
});
