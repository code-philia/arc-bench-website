import { test, expect } from '@playwright/test';

test('REQ-7-1-3.1: Use History', async ({ page }) => {
  // 1. Navigation
  await page.goto('/status');

  // 2. Interaction
  await page.getByRole('button', { name: /JD5162/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/status/i);
});
