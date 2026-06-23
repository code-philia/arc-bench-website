import { test, expect } from '@playwright/test';
import { navigateToSearchResults, selectLocationByTyping } from './helpers';

test('REQ-3.2.4: Search again from the results page', async ({ page }) => {
  // GIVEN: The user is on the ticket search results page.
  await navigateToSearchResults(page);
  await page.waitForTimeout(2000);

  // WHEN: Modify one or more search condition inputs and click the "Search" button.
  // Change the arrival place
  const toInput = page.getByPlaceholder(/^To$/i);
  await toInput.clear();
  await selectLocationByTyping(page, 'To', 'guangzhou');
  await page.getByRole('button', { name: /Search/i }).click();

  // THEN: The page reloads the ticket list and shows the new matching results.
  await expect(page.getByText(/\d+\s*results/i)).toBeVisible({ timeout: 10000 });
});
