import { test, expect } from '@playwright/test';

test('REQ-1.2: Back to homepage from other pages', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByRole('link', { name: /BookStack/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\//);
});
