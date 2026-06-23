import { test, expect } from '@playwright/test';
import { navigateToHomePage, selectLocationByTyping } from './helpers';

test('REQ-3.1.6: Search without a valid departure place', async ({ page }) => {
  // GIVEN: The user is on the home page with the arrival place and departure date filled, and the departure place missing.
  await navigateToHomePage(page);
  await selectLocationByTyping(page, 'To', 'shanghai');
  // Leave the From field empty

  // WHEN: Click the "Search" button.
  await page.getByRole('button', { name: /Search/i }).click();

  // THEN: The page shows "Please select the place of departure." and does not navigate to the search results page.
  await expect(page.getByText(/Please select the place of departure/i)).toBeVisible();
});
