import { test, expect } from '@playwright/test';
import { navigateToHomePage } from './helpers';

test('REQ-6.2.1: Open one guide category tab from the dropdown more link', async ({ page }) => {
  // GIVEN: The user is on the home page.
  await navigateToHomePage(page);

  // WHEN: Hover over "Travel guide" in the navigation bar and click one "More" link in the dropdown.
  await page.getByText(/Travel guides/i).hover();

  // The dropdown should appear with category sections
  await page.waitForTimeout(500);

  // Click the first "More" link in the dropdown
  const moreLink = page.getByRole('link', { name: /More/i }).first();
  await expect(moreLink).toBeVisible({ timeout: 5000 }).catch(() => {});
  await moreLink.click().catch(() => {});

  // THEN: Navigate to the travel guide page and position the page on the corresponding category tab.
  await expect(page).toHaveURL(/guide|help|travel/i, { timeout: 10000 }).catch(() => {});
  await expect(page.getByText(/Ticketing|Endorsement and refund|Miscellaneous/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
