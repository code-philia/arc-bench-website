import { test, expect } from '@playwright/test';

test('REQ-4-5.1: Enter Order Center', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByText(/订单/i).hover();
  await page.getByText(/机票\+相关订单/i).click();

  // 3. Assertion
  await expect(page).toHaveURL(/order/i);
});
