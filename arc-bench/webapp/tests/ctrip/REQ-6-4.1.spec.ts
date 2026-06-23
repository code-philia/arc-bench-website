import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-6-4.1: Standard Password Change Flow', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/security');

  // 2. Interaction
  await page.getByRole('button', { name: /修改/i }).first().click(); // Assuming first one is password
  // Wait for the modify-password page to load
  await page.waitForURL(/modify-password/i, { timeout: 10000 });
  await page.getByPlaceholder(/当前密码/i).fill('4rfv5tgb6yhn');
  await page.getByPlaceholder(/新密码/i).first().fill('newPassword123');
  await page.getByPlaceholder(/确认新密码/i).fill('newPassword123');
  // Click complete
  await page.getByRole('button', { name: /完成/i }).click();

  // 3. Assertion - On success, the page redirects to /login
  await expect(page).toHaveURL(/login/i, { timeout: 10000 });

  // Reset password back to original for other tests
  await fetch('http://localhost:3003/api/users/password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPassword: 'newPassword123', newPassword: '4rfv5tgb6yhn' })
  });
});
