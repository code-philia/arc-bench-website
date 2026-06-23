import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-4-3-2.1: View Free Baggage Allowance', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/book');

  // 2. Assertion
  await expect(page.getByText(/已为你订单免费携带.*行李/i)).toBeVisible();
});
