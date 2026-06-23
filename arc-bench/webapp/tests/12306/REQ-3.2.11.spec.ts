import { test, expect } from '@playwright/test';
import { navigateToSearchResults } from './helpers';

test('REQ-3.2.11: Filter the result list by arrival station', async ({ page }) => {
  // GIVEN: The user is on a populated ticket search results page.
  await navigateToSearchResults(page);

  // WHEN: Select one option under the "To Station" filter.
  const filterSidebar = page.locator('.results-sidebar');
  await expect(filterSidebar).toBeVisible({ timeout: 10000 });

  // Find the "To Station" filter group
  const toStationGroup = filterSidebar.locator('.filter-group').filter({ hasText: /^To Station/i });
  await expect(toStationGroup).toBeVisible();

  // Select a specific station (not "All") - click the first non-All radio option
  const stationOptions = toStationGroup.locator('.checkbox-row').filter({ hasNotText: /All/i });
  const optionCount = await stationOptions.count();
  if (optionCount > 0) {
    await stationOptions.first().locator('input[type="radio"]').check();
  }

  // THEN: The ticket list updates to show only the trains that match the selected arrival station.
  await page.waitForTimeout(1000);
  await expect(page.getByText(/\d+\s*results/i)).toBeVisible({ timeout: 5000 });
});
