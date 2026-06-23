import { test, expect } from '@playwright/test';

test('REQ-2.2: Open Login Entry', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('link', { name: /登录/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/login/i);
});
