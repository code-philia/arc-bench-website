import { test, expect } from '@playwright/test';
import { navigateToHomePage } from './helpers';

test('REQ-1.2: Show the quick guide section on the home page', async ({ page }) => {
  // GIVEN: The user is on the home page.
  await navigateToHomePage(page);

  // WHEN: Observe the content below the banner area.
  // THEN: The page shows a visible "Quick Guide" section reserved for quick links.
  const quickGuideSection = page.locator('section, div').filter({ has: page.getByText(/Quick Guide/i) });
  await expect(quickGuideSection.first()).toBeVisible();
});
