import { test, expect } from '@playwright/test';

test('REQ-2.5.3: Show archived notes', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('navigation').getByRole('button', { name: 'Archive', exact: true }).click();

  // 3. Assertion
  await expect(page.getByRole('heading', { name: 'Archive', exact: true })).toBeVisible();
});
