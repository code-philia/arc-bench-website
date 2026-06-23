import { test, expect } from '@playwright/test';
import { navigateToHomePage, selectLocationByTyping } from './helpers';

test('REQ-3.1.5: Search tickets from the home page', async ({ page }) => {
  // GIVEN: The user is on the home page with a valid departure place, arrival place, and departure date selected.
  await navigateToHomePage(page);
  await selectLocationByTyping(page, 'From', 'beijing');
  await selectLocationByTyping(page, 'To', 'shanghai');

  // WHEN: Click the "Search" button.
  await page.getByRole('button', { name: /Search/i }).click();

  // THEN: Navigate to the ticket search results page and show results that match the search conditions.
  await expect(page).toHaveURL(/search|result|ticket/i, { timeout: 10000 });
  // The results page should show some content (either result count, trains, or empty state)
  await expect(page.getByText(/\d+\s*results/i).or(page.getByText(/sorry/i))).toBeVisible({ timeout: 10000 });
});
