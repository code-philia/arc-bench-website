import { test, expect } from '@playwright/test';

test('REQ-9-2-3.1: Find First Aid Phone Number', async ({ page }) => {
  // 1. Navigation
  await page.goto('/airport/detail/pek');

  // 2. Interaction
  await page.getByRole('tab', { name: /机场电话/i }).waitFor({ timeout: 10000 });
  await page.getByRole('tab', { name: /机场电话/i }).click();

  // 3. Assertion
  await expect(page.getByText(/医疗急救/i)).toBeVisible();
});
