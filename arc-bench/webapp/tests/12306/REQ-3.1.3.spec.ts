import { test, expect } from '@playwright/test';
import { navigateToHomePage } from './helpers';

test('REQ-3.1.3: Select a location from the tabbed selector', async ({ page }) => {
  // GIVEN: The user is on the home page search module.
  await navigateToHomePage(page);

  // WHEN: Click the departure input field to open the tabbed location selector.
  const fromInput = page.getByPlaceholder(/From/i);
  await fromInput.click();

  // THEN: The page shows the tabs "Popular", "ABCDE", "FGHIJ", "KLMNO", "PQRST", and "UVWXYZ".
  await expect(page.getByRole('tab', { name: /Popular/i })).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('tab', { name: /ABCDE/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /FGHIJ/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /KLMNO/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /PQRST/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /UVWXYZ/i })).toBeVisible();

  // Switch to a tab and select a location item
  await page.getByRole('tab', { name: /Popular/i }).click();
  const tabPanel = page.getByRole('tabpanel');
  const locationItem = tabPanel.locator('li, [class*="item"], [class*="station"], [class*="city"]').first();
  await locationItem.click();

  // The input field is filled with the selected location name (non-empty)
  await expect(fromInput).not.toHaveValue('');
});
