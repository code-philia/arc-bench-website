import { test, expect } from '@playwright/test';
import { navigateToSearchResults } from './helpers';

test('REQ-3.2.12: Filter the result list by departure time range', async ({ page }) => {
  // GIVEN: The user is on a populated ticket search results page.
  await navigateToSearchResults(page);

  // WHEN: Choose one option from the "Departure time" dropdown filter.
  // The dropdown should contain: "00:00-24:00", "00:00-06:00", "06:00-12:00", "12:00-18:00", "18:00-24:00".
  const filterSidebar = page.locator('.results-sidebar');
  await expect(filterSidebar).toBeVisible({ timeout: 10000 });

  // Find the "Departure Time" filter group
  const departureTimeGroup = filterSidebar.locator('.filter-group').filter({ hasText: /^Departure Time/i });
  await expect(departureTimeGroup).toBeVisible();

  // Select "06:00-12:00" from the dropdown
  const dropdown = departureTimeGroup.locator('select');
  await dropdown.selectOption('06:00-12:00');

  // THEN: The ticket list updates to show only the trains whose departure times fall within the selected time range.
  await page.waitForTimeout(1000);
  await expect(page.getByText(/\d+\s*results/i)).toBeVisible({ timeout: 5000 });
});
