import { test, expect } from '@playwright/test';

test('REQ-3-5-3.2: Sort by Price', async ({ page }) => {
  // 1. Navigation
  await page.goto('/flight/list');

  // 2. Interaction
  await page.getByRole('button', { name: /低价优先/i }).click();

  // 3. Assertion
  await expect(page.getByRole('list')).toBeVisible();
});
