import { test, expect } from '@playwright/test';

test('REQ-8-1-1.1: Switch to Completed', async ({ page }) => {
  // 1. Navigation
  await page.goto('/reimbursement');

  // 2. Interaction
  await page.getByRole('tab', { name: /已完成/i }).click();

  // 3. Assertion
  await expect(page.getByRole('tab', { name: /已完成/i })).toHaveAttribute('aria-selected', 'true');
});
