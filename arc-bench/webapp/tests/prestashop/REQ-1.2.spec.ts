import { test, expect } from '@playwright/test';

test('REQ-1.2: Logo Click Returns Home', async ({ page }) => {
  // 1. Navigation to a subpage first
  await page.goto('/login'); // Assuming login page exists

  // 2. Interaction
  await page.getByRole('banner').getByRole('link', { name: /logo/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/.*\/$/);
});
