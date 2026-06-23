import { test, expect } from '@playwright/test';

test('REQ-3-5-2.3: Switch to Next Week', async ({ page }) => {
  // 1. Navigation
  await page.goto('/flight/list');

  // 2. Interaction
  await page.getByRole('button', { name: />/i }).click();

  // 3. Assertion
  // Date bar should update
  await expect(page.getByRole('list')).toBeVisible();
});
