import { test, expect } from '@playwright/test';

test('REQ-3-5-2.1: Switch to a Nearby Date', async ({ page }) => {
  // 1. Navigation
  await page.goto('/flight/list');

  // 2. Wait for the page to load, then click on a price label in the1 date strip
  await page.getByText(/¥/i).first().waitFor({ timeout: 10000 });
  await page.getByText(/¥/i).first().click();

  // 3. Assertion - flight list should be visible
  await expect(page.getByRole('list')).toBeVisible();
});
