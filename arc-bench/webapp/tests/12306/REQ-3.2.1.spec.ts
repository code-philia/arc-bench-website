import { test, expect } from '@playwright/test';
import { navigateToSearchResults } from './helpers';

test('REQ-3.2.1: Display the populated ticket search results page', async ({ page }) => {
  // GIVEN: The user has completed a valid ticket search from the home page.
  await navigateToSearchResults(page);

  // WHEN: The search results page finishes loading.
  // THEN: The page shows the search condition inputs, the "Search" button, the date-switching bar,
  // the route summary, the result count, the table headers, and the "Filter" area.

  // Search condition inputs and Search button
  await expect(page.getByPlaceholder(/From/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByPlaceholder(/To/i)).toBeVisible();
  await expect(page.getByPlaceholder(/Date/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Search/i })).toBeVisible();

  // Date-switching bar (shows dates like "Mon, Jun 1")
  await expect(page.locator('.date-switch-bar').first()).toBeVisible();

  // Route summary (pinyin plus Chinese names)
  await expect(page.locator('.route-summary').first()).toBeVisible();

  // Result count (format "xx results")
  await expect(page.getByText(/\d+\s*results/i)).toBeVisible();

  // Wait for the results table to be present before checking headers
  await expect(page.locator('.results-table')).toBeVisible({ timeout: 10000 });

  // Table headers (use columnheader role to avoid matching sidebar text)
  await expect(page.getByRole('columnheader', { name: /Train No/i })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Departure Time/i })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Travel time/i })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Arrival Time/i })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Price/i })).toBeVisible();

  // Filter area
  await expect(page.getByText(/Filter/i)).toBeVisible();
});
