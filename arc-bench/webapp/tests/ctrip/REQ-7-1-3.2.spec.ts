import { test, expect } from '@playwright/test';

test('REQ-7-1-3.2: Clear History', async ({ page }) => {
  // 1. Navigation
  await page.goto('/status');

  // 2. Interaction
  await page.getByText(/清除历史记录/i).click();

  // 3. Assertion
  await expect(page.getByText(/JD5162/i)).toBeHidden();
});
