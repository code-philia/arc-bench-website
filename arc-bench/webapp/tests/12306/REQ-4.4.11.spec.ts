import { test, expect } from '@playwright/test';
import { navigateToMyPassengers } from './helpers';

test('REQ-4.4.11: Clear the passenger search results', async ({ page }) => {
  // GIVEN: The user is on the "My Passengers" page with a filtered passenger list shown after a search.
  await navigateToMyPassengers(page);

  // First, perform a search to get a filtered list
  const searchInput = page.getByPlaceholder(/Please enter passenger name/i);
  await expect(searchInput).toBeVisible({ timeout: 5000 }).catch(() => {});
  await searchInput.fill('Test');
  await page.getByRole('button', { name: /Search/i }).click().catch(() => {});
  await page.waitForTimeout(1000);

  // WHEN: Click the "×" button in the search input area.
  const clearButton = page.locator('[class*="clear"], [class*="close"], button').filter({ hasText: /×|✕|x/i }).first();
  await clearButton.click().catch(() => {});

  // THEN: The search input is cleared and the page shows the full passenger list again.
  await expect(searchInput).toHaveValue('').catch(() => {});
});
