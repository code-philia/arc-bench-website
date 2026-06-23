import { test, expect } from '@playwright/test';

test('REQ-4.8.1: View Description Tab', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();

  // 2. Interaction
  const descTab = page.getByRole('tab', { name: /description/i });
  await descTab.click();

  // 3. Assertion
  const descContent = page.getByRole('tabpanel', { name: /description/i }).or(page.locator('.product-description'));
  await expect(descContent).toBeVisible();
});
