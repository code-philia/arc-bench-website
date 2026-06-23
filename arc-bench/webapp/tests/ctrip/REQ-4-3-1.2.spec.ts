import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-4-3-1.2: View Insurance Terms', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/book');

  // 2. Interaction
  await page.getByText(/查看详情|保险条款/i).first().click();

  // 3. Assertion
  await expect(page.getByRole('dialog', { name: /保险条款/i })).toBeVisible();
});
