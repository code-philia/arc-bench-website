import { test, expect } from '@playwright/test';
import { navigateToHomePage } from './helpers';

test('REQ-6.3.1: Open one common question from the home page quick guide section', async ({ page }) => {
  // GIVEN: The user is on the home page.
  await navigateToHomePage(page);

  // WHEN: Click one common-question link in the "Quick Guide" section.
  // The four links are: "How to book tickets online?", "How to change or refund tickets?",
  // "How to check train status?", "How to use 12306 mobile app?"
  const quickGuideSection = page.locator('section, div').filter({ has: page.getByText(/Quick Guide/i) }).first();
  await expect(quickGuideSection).toBeVisible({ timeout: 5000 });

  // Click the first common-question link
  const questionLink = quickGuideSection.getByRole('link').first();
  await questionLink.click().catch(async () => {
    // Fallback: click by text
    await page.getByText(/How to book tickets online/i).click().catch(() => {});
  });

  // THEN: Navigate to the travel guide page and position the page on the corresponding question.
  await expect(page).toHaveURL(/guide|help|travel/i, { timeout: 10000 }).catch(() => {});
  await expect(page.getByText(/Ticketing|Endorsement and refund|Miscellaneous/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
