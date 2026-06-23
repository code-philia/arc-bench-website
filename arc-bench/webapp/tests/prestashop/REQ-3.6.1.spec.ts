import { test, expect } from '@playwright/test';

test('REQ-3.6.1: Filter by Availability', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // 2. Interaction
  const filterSection = page.locator('#search_filters').or(page.getByRole('complementary', { name: /filter/i }));
  await filterSection.getByLabel(/in stock/i).check();

  // 3. Assertion
  await expect(page).toHaveURL(/.*q=Availability-In\+stock.*/i);
  await expect(page.locator('.active-filter')).toBeVisible();
});
