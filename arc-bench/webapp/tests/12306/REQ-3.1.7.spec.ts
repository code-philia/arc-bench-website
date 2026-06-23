import { test, expect } from '@playwright/test';
import { navigateToHomePage, selectLocationByTyping } from './helpers';

test('REQ-3.1.7: Search without a valid arrival place', async ({ page }) => {
  // GIVEN: The user is on the home page with the departure place and departure date filled, and the arrival place missing.
  await navigateToHomePage(page);
  await selectLocationByTyping(page, 'From', 'beijing');
  // Leave the To field empty

  // WHEN: Click the "Search" button.
  await page.getByRole('button', { name: /Search/i }).click();

  // THEN: The page shows "Please select the place of arrival." and does not navigate to the search results page.
  await expect(page.getByText(/Please select the place of arrival/i)).toBeVisible();
});
