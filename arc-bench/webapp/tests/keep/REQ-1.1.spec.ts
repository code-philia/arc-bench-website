import { test, expect } from '@playwright/test';

test('REQ-1.1: Enter Website', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  // (None required for this scenario)

  // 3. Assertion
  // Verify the home page shows up
  await expect(page.getByRole('banner')).toBeVisible();
});
