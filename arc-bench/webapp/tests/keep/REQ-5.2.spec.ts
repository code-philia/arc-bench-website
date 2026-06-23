import { test, expect } from '@playwright/test';

test('REQ-5.2: Grid View by default', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  // (None)

  // 3. Assertion
  // Notes are in grid view and icon shows List view
  await expect(page.getByRole('button', { name: /list view/i })).toBeVisible();
});
