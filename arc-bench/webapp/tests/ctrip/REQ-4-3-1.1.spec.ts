import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-4-3-1.1: Add Combo Insurance', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/book');

  // 2. Interaction - Click the add insurance button
  const addBtn = page.getByRole('button', { name: /添加保障/i }).first();
  await addBtn.click();

  // 3. Assertion - Button text changes to "已添加"
  await expect(page.getByRole('button', { name: /已添加/i }).first()).toBeVisible();
});
