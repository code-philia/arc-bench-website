import { test, expect } from '@playwright/test';

test('REQ-2-4.1: Enter Registration Page', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('link', { name: /注册/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/register/i);
});
