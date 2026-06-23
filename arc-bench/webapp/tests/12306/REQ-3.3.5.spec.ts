import { test, expect } from '@playwright/test';
import { navigateToNoDirectTrainResults } from './helpers';

test('REQ-3.3.5: Toggle transfer plan sorting by second-segment arrival time', async ({ page }) => {
  // GIVEN: The user is viewing a populated transfer plan list.
  await navigateToNoDirectTrainResults(page);
  await page.waitForTimeout(2000);

  // WHEN: Click the "Arrival Time" header once.
  const arrivalTimeHeader = page.locator('.transfer-headers').getByRole('button', { name: /Arrival Time/i });
  await expect(arrivalTimeHeader).toBeVisible({ timeout: 10000 });
  await arrivalTimeHeader.click();

  // THEN: The transfer plan list is sorted in ascending order.
  // The button text should show the ascending arrow "↑"
  await expect(arrivalTimeHeader).toHaveText(/Arrival Time.*↑/);

  // WHEN: Click the "Arrival Time" header again.
  await arrivalTimeHeader.click();

  // THEN: The transfer plan list is sorted in descending order.
  // The button text should show the descending arrow "↓"
  await expect(arrivalTimeHeader).toHaveText(/Arrival Time.*↓/);
});
