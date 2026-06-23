import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-6-3.1: Enter Security Center', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/center');

  // 2. Interaction
  await page.getByText(/账户安全/i).click();

  // 3. Assertion
  await expect(page.getByText(/建议定期更换|安全等级/i)).toBeVisible();
});
