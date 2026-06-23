import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-6-1.1: View Basic Profile Information', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/center');

  // 2. Interaction
  await page.getByText(/我的信息/i).click();

  // 3. Assertion
  // Assuming a masked mobile number contains asterisks
  await expect(page.getByText(/\*\*\*/).first()).toBeVisible();
});
