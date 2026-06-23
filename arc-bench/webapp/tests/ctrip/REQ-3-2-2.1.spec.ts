import { test, expect } from '@playwright/test';

test('REQ-3-2-2.1: Select Departure Date', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByPlaceholder(/出发日期/i).click();
  // Select a future date (click an enabled day button)
  const enabledDateButtons = page.getByRole('button', { name: /\d+月\d+日/ }).and(page.locator('button:not(.is-disabled)'));
  await enabledDateButtons.last().click();

  // 3. Assertion
  await expect(page.getByPlaceholder(/出发日期/i)).not.toBeEmpty();
});
