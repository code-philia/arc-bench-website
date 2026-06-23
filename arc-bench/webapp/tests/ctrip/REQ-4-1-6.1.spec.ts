import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-4-1-6.1: Real-Time Fee Calculation', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/book');

  // 2. Wait for passengers and initial price
  await page.getByRole('checkbox', { name: /张三/i }).waitFor();

  // 3. Interaction - select passenger
  await page.getByRole('checkbox', { name: /张三/i }).check();

  // 4. Assertion - price details should show passenger count
  await expect(page.getByText(/x1/i).first()).toBeVisible();
  await expect(page.getByText(/订单总价/i)).toBeVisible();
});
