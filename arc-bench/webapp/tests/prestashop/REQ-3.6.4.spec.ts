import { test, expect } from '@playwright/test';

test('REQ-3.6.4: Clear All Filters', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // Apply a filter first
  const filterSection = page.locator('#search_filters').or(page.getByRole('complementary', { name: /filter/i }));
  await filterSection.getByLabel(/in stock/i).check();
  await expect(page.locator('.active-filter')).toBeVisible();

  // 2. Interaction
  await page.getByRole('button', { name: /clear all/i }).click();

  // 3. Assertion
  await expect(page.locator('.active-filter')).not.toBeVisible();
});
