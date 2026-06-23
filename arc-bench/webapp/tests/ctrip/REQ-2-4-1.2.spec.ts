import { test, expect } from '@playwright/test';

test('REQ-2-4-1.2: Decline Registration Agreement', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByText(/免费注册/i).click();
  await page.getByRole('button', { name: /不同意/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\//);
});
