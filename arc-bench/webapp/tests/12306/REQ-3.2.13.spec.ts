import { test, expect } from '@playwright/test';
import { navigateToHomePage, selectLocationByTyping } from './helpers';

test('REQ-3.2.13: Enter the results page from the home quick search module', async ({ page }) => {
  // GIVEN: The user is on the home page with valid quick search conditions selected.
  await navigateToHomePage(page);
  await selectLocationByTyping(page, 'From', 'beijing');
  await selectLocationByTyping(page, 'To', 'shanghai');

  // WHEN: Click the "Search" button in the quick search module.
  await page.getByRole('button', { name: /Search/i }).click();

  // THEN: Navigate to the ticket search results page and show the corresponding results.
  await expect(page).toHaveURL(/search|result|ticket/i, { timeout: 10000 });
  // The results page should display search conditions or results
  await expect(page.getByPlaceholder(/From/i)).toBeVisible({ timeout: 10000 });
});
