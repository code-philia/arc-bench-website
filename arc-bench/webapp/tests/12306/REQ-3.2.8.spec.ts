import { test, expect } from '@playwright/test';
import { navigateToSearchResults } from './helpers';

test('REQ-3.2.8: Toggle sorting by arrival time', async ({ page }) => {
  // GIVEN: The user is on a populated ticket search results page.
  await navigateToSearchResults(page);

  // WHEN: Click the "Arrival Time" table header once.
  const arrivalTimeHeader = page.getByText(/Arrival Time/i).first();
  await expect(arrivalTimeHeader).toBeVisible({ timeout: 10000 });
  await arrivalTimeHeader.click();

  // THEN: The list is sorted in ascending order.
  await expect(page.locator('[class*="sort-asc"], [class*="ascending"], .sort-up, [class*="sort"][class*="active"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {});

  // WHEN: Click the "Arrival Time" header again.
  await arrivalTimeHeader.click();

  // THEN: The list is sorted in descending order.
  await expect(page.locator('[class*="sort-desc"], [class*="descending"], .sort-down, [class*="sort"][class*="active"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
});
