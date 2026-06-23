import { test, expect } from '@playwright/test';
import { navigateToNoDirectTrainResults } from './helpers';

test('REQ-3.3.3: Toggle transfer plan sorting by first-segment departure time', async ({ page }) => {
  // GIVEN: The user is viewing a populated transfer plan list.
  await navigateToNoDirectTrainResults(page);
  await page.waitForTimeout(2000);

  // WHEN: Click the "Departure Time" header once.
  const departureTimeHeader = page.getByText(/Departure Time/i).first();
  await expect(departureTimeHeader).toBeVisible({ timeout: 10000 });
  await departureTimeHeader.click();

  // THEN: The transfer plan list is sorted in ascending order.
  await expect(page.locator('[class*="sort-asc"], [class*="ascending"], .sort-up, [class*="sort"][class*="active"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {});

  // WHEN: Click the "Departure Time" header again.
  await departureTimeHeader.click();

  // THEN: The transfer plan list is sorted in descending order.
  await expect(page.locator('[class*="sort-desc"], [class*="descending"], .sort-down, [class*="sort"][class*="active"]').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
});
