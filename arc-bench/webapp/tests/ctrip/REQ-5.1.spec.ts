import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5.1: Enter Personal Center', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/center');

  // 2. Assertion - Should be on user center page
  await expect(page.getByText(/常用信息|个人中心/i).first()).toBeVisible();
});
