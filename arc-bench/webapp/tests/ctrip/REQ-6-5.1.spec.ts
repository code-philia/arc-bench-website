import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-6-5.1: Verify Identity and Bind New Phone', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/security');

  // 2. Interaction
  await page.getByRole('button', { name: /修改/i }).nth(1).click(); // Assuming second one is phone
  // Wait for the modify-phone page to load
  await page.waitForURL(/modify-phone/i, { timeout: 10000 });
  await page.getByPlaceholder(/登录密码/i).fill('4rfv5tgb6yhn');
  await page.getByPlaceholder(/新手机号/i).fill('13900139000');
  // Handle any dialog and click next
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /下一步/i }).click();

  // 3. Assertion
  await expect(page.getByText(/验证新手机/i)).toBeVisible();
});
