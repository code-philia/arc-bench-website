import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-6-2.1: Update Profile and Save', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/profile');

  // 2. Interaction
  await page.getByRole('button', { name: /编辑/i }).click();
  await page.getByPlaceholder(/昵称/i).fill('新昵称');
  await page.getByRole('radio', { name: /男/i }).check();
  await page.getByRole('button', { name: /保存/i }).click();

  // 3. Assertion
  await expect(page.getByText(/保存成功/i)).toBeVisible();
  await expect(page.getByText('新昵称')).toBeVisible();
});
