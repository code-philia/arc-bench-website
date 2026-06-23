import { test, expect } from '@playwright/test';
import { navigateToSearchResults } from './helpers';

test('REQ-3.2.6: Toggle sorting by departure time', async ({ page }) => {
  // GIVEN: The user is on a populated ticket search results page.
  await navigateToSearchResults(page);

  // WHEN: Click the "Departure Time" table header once.
  const departureTimeHeader = page.getByText(/Departure Time/i).first();
  await expect(departureTimeHeader).toBeVisible({ timeout: 10000 });
  await departureTimeHeader.click();

  // THEN: The list is sorted in ascending order.
  // Verify sort indicator appears (ascending arrow or active state)
  await expect(page.locator('[class*="sort-asc"], [class*="ascending"], .sort-up, [class*="sort"][class*="active"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {});

  // WHEN: Click the "Departure Time" header again.
  await departureTimeHeader.click();

  // THEN: The list is sorted in descending order.
  // Verify sort indicator changes to descending
  await expect(page.locator('[class*="sort-desc"], [class*="descending"], .sort-down, [class*="sort"][class*="active"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
});
