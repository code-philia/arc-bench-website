import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-2-2.1: Save a New Address', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/addresses/new');

  // Wait for form to load
  await page.getByPlaceholder(/收件人/i).waitFor({ timeout: 10000 });

  // 2. Interaction
  await page.getByPlaceholder(/收件人/i).fill('测试收件人');
  await page.getByPlaceholder(/详细地址/i).fill('测试详细地址123号');
  await page.getByPlaceholder(/手机号/i).fill('13800138000');
  await page.getByRole('button', { name: /保存/i }).click();

  // 3. Assertion - Wait for the list to reload after save
  await expect(page.getByText('测试收件人').first()).toBeVisible({ timeout: 10000 });
});
