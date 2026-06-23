import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-4-3-3.1: Reserve an Airport Drop-Off Service', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/book');

  // 2. Wait for services to load and interaction
  await page.getByRole('heading', { name: /接送机/i }).waitFor();
  await page.getByRole('button', { name: /送我去/i }).first().click();
  await page.getByPlaceholder(/接送地址/i).fill('成都市天府广场');
  await page.getByPlaceholder(/接送地址/i).blur();

  // 3. Assertion
  await expect(page.getByText(/订单总价/i)).toBeVisible();
});
