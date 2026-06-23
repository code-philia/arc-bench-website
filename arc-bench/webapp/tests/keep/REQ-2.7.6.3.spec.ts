import { test, expect } from '@playwright/test';

test('REQ-2.7.6.3: View Reminders', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('navigation').getByRole('button', { name: 'Reminders', exact: true }).click();

  // 3. Assertion
  await expect(page.getByRole('heading', { name: 'Reminders', exact: true })).toBeVisible();
});
