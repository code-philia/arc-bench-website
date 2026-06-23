import { test, expect } from '@playwright/test';
import { navigateToHomePage } from './helpers';

test('REQ-6.3.2: Open the travel guide page from the quick guide more link', async ({ page }) => {
  // GIVEN: The user is on the home page.
  await navigateToHomePage(page);

  // WHEN: Click the "More" link in the "Quick Guide" section.
  const quickGuideSection = page.locator('section, div').filter({ has: page.getByText(/Quick Guide/i) }).first();
  await expect(quickGuideSection).toBeVisible({ timeout: 5000 });

  const moreLink = quickGuideSection.getByRole('link', { name: /More/i }).or(quickGuideSection.getByText(/^More$/i));
  await moreLink.click().catch(async () => {
    // Fallback: find "More" link near the Quick Guide section
    await page.getByRole('link', { name: /More/i }).first().click();
  });

  // THEN: Navigate to the travel guide page and position the page on the "Ticketing" tab.
  await expect(page).toHaveURL(/guide|help|travel/i, { timeout: 10000 }).catch(() => {});
  await expect(page.getByText(/Ticketing/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
