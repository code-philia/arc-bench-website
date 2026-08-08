import { expect, test } from '@playwright/test';
import { openAccountAccess, uniqueAccount } from './support/e2e';

test('REQ-1-1-1：访客可注册唯一账户，且验证提示在重新打开后仍可见', async ({ page }) => {
  const account = uniqueAccount();

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign up/i }).click();
  await page.getByLabel(/username|用户名/i).fill(account.username);
  await page.getByLabel(/email|邮箱/i).fill(account.email);
  await page.getByLabel(/^password$|密码$/i).fill(account.password);
  await page.getByLabel(/confirm password|确认密码/i).fill(account.password);
  await page.getByRole('checkbox', { name: /terms|条款/i }).check();
  await page.getByRole('button', { name: /create account|创建账户/i }).click();

  await expect(page.getByText(/verify.*email|验证.*邮箱|邮箱.*验证/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/verify.*email|验证.*邮箱|邮箱.*验证/i)).toBeVisible();
});

test('REQ-1-1-1：重复用户名或邮箱与不合规密码不会创建账户，并保留已填写内容', async ({ page }) => {
  const existing = uniqueAccount();
  const attempted = uniqueAccount();

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign up/i }).click();
  await page.getByLabel(/username|用户名/i).fill(existing.username);
  await page.getByLabel(/email|邮箱/i).fill(existing.email);
  await page.getByLabel(/^password$|密码$/i).fill(existing.password);
  await page.getByLabel(/confirm password|确认密码/i).fill(existing.password);
  await page.getByRole('checkbox', { name: /terms|条款/i }).check();
  await page.getByRole('button', { name: /create account|创建账户/i }).click();
  await expect(page.getByText(/verify.*email|验证.*邮箱|邮箱.*验证/i)).toBeVisible();

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign up/i }).click();
  await page.getByLabel(/username|用户名/i).fill(existing.username);
  await page.getByLabel(/email|邮箱/i).fill(attempted.email);
  await page.getByLabel(/^password$|密码$/i).fill('short');
  await page.getByLabel(/confirm password|确认密码/i).fill('short');
  await page.getByRole('checkbox', { name: /terms|条款/i }).check();
  await page.getByRole('button', { name: /create account|创建账户/i }).click();

  await expect(page.getByText(/username.*(taken|unavailable|exists)|用户名.*(已存在|不可用)|password.*(invalid|weak|require)|密码.*(不符合|至少|无效)/i)).toBeVisible();
  await expect(page.getByLabel(/username|用户名/i)).toHaveValue(existing.username);
  await expect(page.getByLabel(/email|邮箱/i)).toHaveValue(attempted.email);
  await expect(page.getByText(/verify.*email|验证.*邮箱|邮箱.*验证/i)).not.toBeVisible();
});

test('REQ-1-1-1：未同意条款或确认密码不一致时，不会开始账户验证', async ({ page }) => {
  const account = uniqueAccount();

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign up/i }).click();
  await page.getByLabel(/username|用户名/i).fill(account.username);
  await page.getByLabel(/email|邮箱/i).fill(account.email);
  await page.getByLabel(/^password$|密码$/i).fill(account.password);
  await page.getByLabel(/confirm password|确认密码/i).fill(`${account.password}-mismatch`);
  await page.getByRole('button', { name: /create account|创建账户/i }).click();

  await expect(page.getByText(/terms.*required|agree.*terms|条款.*(必须|同意)|password.*match|密码.*一致/i)).toBeVisible();
  await expect(page.getByLabel(/username|用户名/i)).toHaveValue(account.username);
  await expect(page.getByText(/verify.*email|验证.*邮箱|邮箱.*验证/i)).not.toBeVisible();
});

test('REQ-1-1-1：已存在邮箱单独冲突时不会创建第二个账户', async ({ page }) => {
  const existing = uniqueAccount();
  const attempted = uniqueAccount();

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign up/i }).click();
  await page.getByLabel(/username|用户名/i).fill(existing.username);
  await page.getByLabel(/email|邮箱/i).fill(existing.email);
  await page.getByLabel(/^password$|密码$/i).fill(existing.password);
  await page.getByLabel(/confirm password|确认密码/i).fill(existing.password);
  await page.getByRole('checkbox', { name: /terms|条款/i }).check();
  await page.getByRole('button', { name: /create account|创建账户/i }).click();
  await expect(page.getByText(/verify.*email|验证.*邮箱|邮箱.*验证/i)).toBeVisible();

  await openAccountAccess(page);
  await page.getByRole('link', { name: /sign up/i }).click();
  await page.getByLabel(/username|用户名/i).fill(attempted.username);
  await page.getByLabel(/email|邮箱/i).fill(existing.email);
  await page.getByLabel(/^password$|密码$/i).fill(attempted.password);
  await page.getByLabel(/confirm password|确认密码/i).fill(attempted.password);
  await page.getByRole('checkbox', { name: /terms|条款/i }).check();
  await page.getByRole('button', { name: /create account|创建账户/i }).click();

  await expect(page.getByText(/email.*(taken|unavailable|exists)|邮箱.*(已存在|不可用)/i)).toBeVisible();
  await expect(page.getByText(/verify.*email|验证.*邮箱|邮箱.*验证/i)).not.toBeVisible();
});
