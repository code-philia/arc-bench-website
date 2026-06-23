import { test, expect } from '@playwright/test';
import { navigateToNoDirectTrainResults } from './helpers';

test('REQ-3.3.1: Display transfer plans after a no-direct-train search', async ({ page }) => {
  // GIVEN: The user is on the ticket search results page and there is no direct train for the current search.
  await navigateToNoDirectTrainResults(page);

  // WHEN: The page calculates available transfer plans.
  // THEN: The page shows up to 10 qualified transfer plans sorted by total travel time.
  await page.waitForTimeout(2000);

  // Transfer section should be visible
  const transferSection = page.locator('.transfer-section');
  await expect(transferSection).toBeVisible({ timeout: 10000 });

  // There should be at least one transfer plan (transfer-card), and at most 10
  const transferPlans = page.locator('.transfer-card');
  const planCount = await transferPlans.count();
  expect(planCount).toBeGreaterThan(0);
  expect(planCount).toBeLessThanOrEqual(10);
});
