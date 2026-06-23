import { test, expect } from '@playwright/test';
import { navigateToSearchResultsViaNav } from './helpers';

test('REQ-3.2.14: Enter the results page from the navigation dropdown', async ({ page }) => {
  // GIVEN: The user is on the home page.
  // WHEN: Hover over "Booking" in the navigation bar and click the "Tickets" option in the dropdown.
  await navigateToSearchResultsViaNav(page);

  // THEN: Navigate to the ticket search results page and show the default results
  // for departure place Beijing, arrival place Shanghai, and the current date.
  await expect(page).toHaveURL(/search|result|ticket/i, { timeout: 10000 });

  // Verify the search conditions reflect the defaults (Beijing, Shanghai)
  const fromInput = page.getByPlaceholder(/From/i);
  const toInput = page.getByPlaceholder(/To/i);
  await expect(fromInput).toHaveValue(/beijing|北京/i);
  await expect(toInput).toHaveValue(/shanghai|上海/i);
});
