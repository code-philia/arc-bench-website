import { test, expect } from '@playwright/test';
import { navigateToHomePage, selectLocationByTyping } from './helpers';

test('REQ-3.2.3: Show the empty result state when no train matches', async ({ page }) => {
  // GIVEN: The user has searched with valid conditions and there is no matching train.
  // Use a route that has no trains (see prerequisites).
  await navigateToHomePage(page);
  await selectLocationByTyping(page, 'From', 'beijing');
  await selectLocationByTyping(page, 'To', 'lhasa');
  await page.getByRole('button', { name: /Search/i }).click();

  // WHEN: The search results page finishes loading.
  // THEN: The page keeps the search condition inputs visible at the top
  // and shows "assets/empty.png" with the text "sorry, according to your inquiry condition, there is no train at present."
  await expect(page.getByPlaceholder(/From/i)).toBeVisible({ timeout: 10000 });
  await expect(page.locator('img[src*="empty"]')).toBeVisible();
  await expect(page.getByText(/sorry.*no train at present/i)).toBeVisible();
});
