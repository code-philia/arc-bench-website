import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-4-2.2: Configure Special VAT Invoice', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/invoices/new');

  // 2. Interaction
  await page.getByRole('radio', { name: /需要.*专票/i }).check();

  // 3. Assertion
  await expect(page.getByPlaceholder(/注册地址/i)).toBeVisible();
  await expect(page.getByPlaceholder(/注册电话/i)).toBeVisible();
  await expect(page.getByPlaceholder(/开户银行/i)).toBeVisible();
});
