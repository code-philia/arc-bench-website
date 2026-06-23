import { test, expect } from '@playwright/test';
import { navigateToHomePage } from './helpers';

test('REQ-3.1.1: Display the quick search module on the home page', async ({ page }) => {
  // GIVEN: The user is on the home page.
  await navigateToHomePage(page);

  // WHEN: Observe the search area.
  // THEN: The page shows inputs with the placeholders "From", "To", and "Date", and a "Search" button.
  await expect(page.getByPlaceholder(/From/i)).toBeVisible();
  await expect(page.getByPlaceholder(/^To$/i)).toBeVisible();
  await expect(page.getByPlaceholder(/Date/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Search/i })).toBeVisible();
});
