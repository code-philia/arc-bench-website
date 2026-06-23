import { test, expect } from '@playwright/test';

test('REQ-2-4-1.1: Trigger Registration Agreement', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByText(/免费注册/i).click();

  // 3. Assertion
  await expect(page.getByRole('dialog', { name: /携程用户注册协议和隐私政策/i })).toBeVisible();

  // 4. Further Interaction
  await page.getByRole('button', { name: /同意并继续/i }).click();

  // 5. Assertion
  await expect(page).toHaveURL(/register/i);
});
