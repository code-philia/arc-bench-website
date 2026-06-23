import { test, expect } from '@playwright/test';
import { navigateToHomePage } from './helpers';

test('REQ-6.1.1: Open the travel guide page from the navigation bar', async ({ page }) => {
  // GIVEN: The user is on the home page.
  await navigateToHomePage(page);

  // WHEN: Click the "Travel guide" link in the navigation bar.
  await page.getByText(/Travel guides/i).click();

  // THEN: Navigate to the travel guide page and show the three tabs.
  await expect(page.getByRole('button', { name: /Ticketing/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /Endorsement and refund/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Miscellaneous/i })).toBeVisible();
});
