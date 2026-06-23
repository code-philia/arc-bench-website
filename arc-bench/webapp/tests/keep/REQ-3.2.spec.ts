import { test, expect } from '@playwright/test';

test('REQ-3.2: Search by keyword', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByPlaceholder(/search/i).click();
  await page.getByPlaceholder(/search/i).fill('st');
  await page.keyboard.press('Enter');

  // 3. Assertion
  await expect(page.getByRole('main')).toBeVisible();
});
