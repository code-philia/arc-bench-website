import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-4-3.1: Delete a Single Receipt', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/invoices');

  // 2. Interaction
  await page.getByRole('button', { name: /删除/i }).first().click();
  await page.getByRole('button', { name: /确定|确认/i }).click();

  // 3. Assertion
  await expect(page.getByText(/删除成功/i)).toBeVisible();
});
