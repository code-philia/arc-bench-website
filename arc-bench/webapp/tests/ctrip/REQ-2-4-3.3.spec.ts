import { test, expect } from '@playwright/test';

test('REQ-2-4-3.3: Exception Password Too Weak', async ({ page }) => {
  // 1. Navigation
  await page.goto('/register/password');

  // 2. Interaction
  await page.getByPlaceholder(/^密码$/i).fill('123');
  await page.getByRole('button', { name: /完成注册/i }).click();

  // 3. Assertion
  await expect(page.getByText(/密码需包含字母和数字，且长度不小于8位/i)).toBeVisible();
});
