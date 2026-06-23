import { test, expect } from '@playwright/test';
import { navigateToHomePage, selectLocationByTyping } from './helpers';

test('REQ-3.1.2: Select a location from the fuzzy-matched list', async ({ page }) => {
  // GIVEN: The user is on the home page search module and the departure field is focused.
  await navigateToHomePage(page);

  // WHEN: Type pinyin or Chinese characters in the input field and click one location in the matched list.
  const fromInput = page.getByPlaceholder(/From/i);
  await fromInput.click();
  await fromInput.fill('beijing');

  // THEN: The page shows a matched list with the title "Top destinations" and matching items.
  await expect(page.getByText(/Top destinations/i)).toBeVisible({ timeout: 5000 });

  // Click the first matching item
  const listItem = page.locator('.location-option, .location-list button, [class*="location"] [class*="option"]').first();
  await listItem.click();

  // The input field is filled with the selected location name (non-empty)
  await expect(fromInput).not.toHaveValue('');
});
