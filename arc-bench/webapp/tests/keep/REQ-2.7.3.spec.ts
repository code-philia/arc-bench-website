import { test, expect } from '@playwright/test';

test('REQ-2.7.3: Default label', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  // (View the labels list in sidebar)

  // 3. Assertion
  await expect(page.getByRole('navigation').getByText(/reminders/i)).toBeVisible();
});
