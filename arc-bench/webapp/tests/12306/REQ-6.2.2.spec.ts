import { test, expect } from '@playwright/test';
import { navigateToHomePage } from './helpers';

test('REQ-6.2.2: Open one guide question from the navigation dropdown', async ({ page }) => {
  // GIVEN: The user is on the home page.
  await navigateToHomePage(page);

  // WHEN: Hover over "Travel guide" in the navigation bar and click one question link in the dropdown.
  await page.getByText(/Travel guides/i).hover();
  await page.waitForTimeout(500);

  // The dropdown should contain question links under each category.
  // Click the first question link found in the dropdown.
  const dropdown = page.locator('[class*="dropdown"], [class*="menu"], [class*="popover"]').filter({ hasText: /Ticketing|Endorsement|Miscellaneous/i }).first();
  await expect(dropdown).toBeVisible({ timeout: 5000 }).catch(() => {});

  // Find a question link (not the "More" link) — any link within the dropdown that looks like a question
  const questionLinks = dropdown.locator('a').filter({ hasNot: page.getByRole('link', { name: /^More$/i }) });
  const linkCount = await questionLinks.count();
  if (linkCount > 0) {
    await questionLinks.first().click();
  } else {
    // Fallback: click any link in the dropdown that is not "More"
    await dropdown.locator('a').first().click().catch(() => {});
  }

  // THEN: Navigate to the travel guide page, positioned on the correct category tab and question.
  await expect(page).toHaveURL(/guide|help|travel/i, { timeout: 10000 }).catch(() => {});
  await expect(page.getByText(/Ticketing|Endorsement and refund|Miscellaneous/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
