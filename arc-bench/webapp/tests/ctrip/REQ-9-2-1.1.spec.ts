import { test, expect } from '@playwright/test';

test('REQ-9-2-1.1: View Airport Overview', async ({ page }) => {
  // 1. Navigation
  await page.goto('/airport/detail/pek'); // Mock airport detail

  // 2. Interaction
  await page.getByRole('tab', { name: /机场简介/i }).waitFor({ timeout: 10000 });
  await page.getByRole('tab', { name: /机场简介/i }).click();

  // 3. Assertion
  await expect(page.getByText(/中国第一国门/i).first()).toBeVisible();
});
