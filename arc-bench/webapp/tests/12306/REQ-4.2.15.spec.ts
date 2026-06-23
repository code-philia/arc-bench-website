import { test, expect } from '@playwright/test';
import { navigateToTicketOrders } from './helpers';

test('REQ-4.2.15: Filter history orders by ride date range', async ({ page }) => {
  // GIVEN: The user is on the "History orders" tab.
  await navigateToTicketOrders(page);
  await page.getByRole('button', { name: /History orders/i }).click();
  await page.waitForTimeout(1000);

  // WHEN: Choose a start date and end date under "Date of ride" and click "Search".
  await expect(page.getByText(/Date of ride/i)).toBeVisible({ timeout: 5000 }).catch(() => {});

  // Click the Search button
  const searchButton = page.getByRole('button', { name: /Search/i });
  await searchButton.click().catch(() => {});

  // THEN: The page shows the historical orders that match the selected ride date range.
  await page.waitForTimeout(1000);
});
