import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-2-5.1: Log Out', async ({ page }) => {
  // 1. Login first
  await login(page);

  // 2. Interaction
  await page.getByText(/尊敬的/i).hover();
  await page.getByText(/退出登录/i).click();

  // 3. Assertion
  await expect(page).toHaveURL(/login/i);
});
