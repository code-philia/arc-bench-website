import { test, expect } from '@playwright/test';

test('REQ-3.6.2: Filter by Color', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // 2. Interaction
  const filterSection = page.locator('#search_filters').or(page.getByRole('complementary', { name: /filter/i }));
  const colorFilter = filterSection.getByLabel(/white/i).or(filterSection.locator('a', { hasText: /white/i }));
  await colorFilter.click();

  // 3. Assertion
  await expect(page).toHaveURL(/.*q=Color-White.*/i);
  await expect(page.locator('.active-filter')).toBeVisible();
});
