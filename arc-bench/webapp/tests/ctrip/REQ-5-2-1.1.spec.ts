import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-2-1.1: View Address List', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/addresses');

  // 2. Assertion - Address management section should be visible
  await expect(page.getByText(/常用地址/i).first()).toBeVisible();
});
