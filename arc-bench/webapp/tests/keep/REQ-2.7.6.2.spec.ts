import { test, expect } from '@playwright/test';

test('REQ-2.7.6.2: View all notes', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('navigation').getByRole('button', { name: 'Notes', exact: true }).click();

  // 3. Assertion
  await expect(page.getByText(/take a note/i)).toBeVisible();
});
