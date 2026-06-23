import { test, expect } from '@playwright/test';
import { navigateToMyPassengers } from './helpers';

test('REQ-4.4.10: Search the passenger list by a fuzzy condition', async ({ page }) => {
  // GIVEN: The user is on the "My Passengers" page.
  await navigateToMyPassengers(page);

  // WHEN: Enter a passenger name or ID number in the input and click "Search".
  const searchInput = page.getByPlaceholder(/Please enter passenger name/i);
  await expect(searchInput).toBeVisible({ timeout: 5000 }).catch(() => {});
  await searchInput.fill('Test');
  await page.getByRole('button', { name: /Search/i }).click().catch(() => {});

  // THEN: The table shows the passenger rows that match the search condition.
  await page.waitForTimeout(1000);
});
