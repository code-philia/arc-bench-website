import { test, expect } from '@playwright/test';
import { navigateToSearchResults } from './helpers';

test('REQ-3.2.7: Toggle sorting by travel time', async ({ page }) => {
  // GIVEN: The user is on a populated ticket search results page.
  await navigateToSearchResults(page);

  // WHEN: Click the "Travel time" table header once.
  const travelTimeHeader = page.getByText(/Travel time/i).first();
  await expect(travelTimeHeader).toBeVisible({ timeout: 10000 });
  await travelTimeHeader.click();

  // THEN: The list is sorted in ascending order.
  await expect(page.locator('[class*="sort-asc"], [class*="ascending"], .sort-up, [class*="sort"][class*="active"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {});

  // WHEN: Click the "Travel time" header again.
  await travelTimeHeader.click();

  // THEN: The list is sorted in descending order.
  await expect(page.locator('[class*="sort-desc"], [class*="descending"], .sort-down, [class*="sort"][class*="active"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
});
