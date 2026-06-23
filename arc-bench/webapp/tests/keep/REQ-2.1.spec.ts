import { test, expect } from '@playwright/test';

test('REQ-2.1: Note Listing', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  // (None required for this scenario)

  // 3. Assertion
  // Note list shows up
  await expect(page.getByRole('main')).toBeVisible();
});
