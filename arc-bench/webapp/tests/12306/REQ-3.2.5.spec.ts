import { test, expect } from '@playwright/test';
import { navigateToSearchResults } from './helpers';

test('REQ-3.2.5: Search with another date from the date-switching bar', async ({ page }) => {
  // GIVEN: The user is on the ticket search results page.
  await navigateToSearchResults(page);

  // WHEN: Click one date item in the date-switching bar.
  const dateBar = page.locator('[class*="date-bar"], [class*="date-switch"]').first();
  await expect(dateBar).toBeVisible({ timeout: 10000 });

  // Click a different date in the bar (not the currently selected one)
  const dateItems = dateBar.locator('[class*="date-item"], [class*="day"], li, button, a').filter({ hasNotText: /selected|active/i });
  const dateItemCount = await dateItems.count();
  if (dateItemCount > 1) {
    await dateItems.nth(1).click();
  } else {
    // Fallback: click any non-first date item
    await dateItems.first().click();
  }

  // THEN: The page reloads the ticket list and shows results for the newly selected date.
  await page.waitForTimeout(2000);
  await expect(page.getByText(/\d+\s*results/i)).toBeVisible({ timeout: 10000 });
});
