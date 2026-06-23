import { test, expect } from '@playwright/test';

test('REQ-3-3.1: Configure Special Passengers', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('checkbox', { name: /带儿童/i }).check();
  await page.getByRole('button', { name: /搜索/i }).click();

  // 3. Assertion (Navigate to results)
  await expect(page).toHaveURL(/flight/i);
});
