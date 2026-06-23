import { test, expect } from '@playwright/test';

test('REQ-3-5-3.1: Combined Filters', async ({ page }) => {
  // 1. Navigation
  await page.goto('/flight/list');

  // 2. Interaction
  await page.getByRole('checkbox', { name: /直飞/i }).check();
  await page.getByRole('combobox', { name: /航空公司/i }).click();
  await page.getByRole('option', { name: /南方航空/i }).click();

  // 3. Assertion
  await expect(page.getByText(/经停/i)).toBeHidden();
});
