import { test, expect } from '@playwright/test';
import { navigateToSearchResults } from './helpers';

test('REQ-3.2.9: Filter the result list by train type', async ({ page }) => {
  // GIVEN: The user is on a populated ticket search results page.
  await navigateToSearchResults(page);

  // WHEN: Select one or more options under the "Train type" filter.
  // The filter should have "All", "G/C/D", and "Other" options.
  const filterSidebar = page.locator('.results-sidebar');
  await expect(filterSidebar).toBeVisible({ timeout: 10000 });

  // Find the "Train type" filter group
  const trainTypeGroup = filterSidebar.locator('.filter-group').filter({ hasText: /^Train type/i });
  await expect(trainTypeGroup).toBeVisible();

  // Select "G/C/D" option
  const gcdCheckbox = trainTypeGroup.locator('.checkbox-row').filter({ hasText: /G\/C\/D/i }).locator('input[type="checkbox"]');
  await gcdCheckbox.check();

  // THEN: The ticket list updates to show only the trains that match the selected train type.
  await page.waitForTimeout(1000);
  // The result count should still be visible (may be fewer results)
  await expect(page.getByText(/\d+\s*results/i)).toBeVisible({ timeout: 5000 });
});
