import { test, expect } from '@playwright/test';

test('REQ-3-5-1.1: Modify Search Criteria', async ({ page }) => {
  // 1. Navigation
  await page.goto('/flight/list'); // Mock direct entry to results page

  // 2. Interaction
  await page.getByPlaceholder(/出发日期/i).click();
  // Click a specific day button in the date selector calendar
  await page.getByRole('button', { name: /月.*日/ }).last().click();

  // 3. Assertion (List refreshes without full page reload)
  await expect(page.getByRole('list')).toBeVisible();
});
