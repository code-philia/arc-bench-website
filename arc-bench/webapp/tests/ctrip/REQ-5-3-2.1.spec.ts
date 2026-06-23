import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-3-2.1: Add a Default Contact', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/contacts/new');

  // 2. Interaction
  await page.getByPlaceholder(/姓名/i).fill('测试联系人');
  await page.getByPlaceholder(/手机号/i).fill('13800138000');
  await page.getByRole('checkbox', { name: /设置为默认联系人/i }).check();
  await page.getByRole('button', { name: /保存/i }).click();

  // 3. Assertion
  await expect(page.getByText(/默认/i).first()).toBeVisible();
});
