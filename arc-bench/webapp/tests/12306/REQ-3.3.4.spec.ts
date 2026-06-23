import { test, expect } from '@playwright/test';
import { navigateToNoDirectTrainResults } from './helpers';

test('REQ-3.3.4: Toggle transfer plan sorting by total travel time', async ({ page }) => {
  // GIVEN: The user is viewing a populated transfer plan list.
  await navigateToNoDirectTrainResults(page);
  await page.waitForTimeout(2000);

  // WHEN: Click the "Travel time" header once.
  const travelTimeHeader = page.locator('.transfer-headers').getByRole('button', { name: /Travel time/i });
  await expect(travelTimeHeader).toBeVisible({ timeout: 10000 });
  await travelTimeHeader.click();

  // THEN: The transfer plan list is sorted in ascending order.
  // The button text should show the ascending arrow "↑"
  await expect(travelTimeHeader).toHaveText(/Travel time.*↑/);

  // WHEN: Click the "Travel time" header again.
  await travelTimeHeader.click();

  // THEN: The transfer plan list is sorted in descending order.
  // The button text should show the descending arrow "↓"
  await expect(travelTimeHeader).toHaveText(/Travel time.*↓/);
});
