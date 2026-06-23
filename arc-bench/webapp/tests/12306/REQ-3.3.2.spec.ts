import { test, expect } from '@playwright/test';
import { navigateToNoDirectTrainResults } from './helpers';

test('REQ-3.3.2: Display detailed information for each transfer plan', async ({ page }) => {
  // GIVEN: The user is viewing transfer plans on the ticket search results page.
  await navigateToNoDirectTrainResults(page);
  await page.waitForTimeout(2000);

  // WHEN: Observe one transfer plan.
  // THEN: The plan shows the first train segment, the second train segment, the transfer waiting time, and a "Book" button.
  const transferPlans = page.locator('.transfer-card');
  await expect(transferPlans.first()).toBeVisible({ timeout: 10000 });

  const firstPlan = transferPlans.first();

  // Should have the combined train number heading (e.g. "G123 + G456")
  await expect(firstPlan.locator('h4')).toBeVisible();

  // Should show two route lines with arrow (station -> station)
  const routeLines = firstPlan.locator('p').filter({ hasText: /→/ });
  const routeLineCount = await routeLines.count();
  expect(routeLineCount).toBeGreaterThanOrEqual(2);

  // Should show transfer waiting time
  await expect(firstPlan.getByText(/Transfer waiting time/i)).toBeVisible();

  // Should have a "Book" button
  await expect(firstPlan.getByRole('button', { name: /Book/i })).toBeVisible();
});
