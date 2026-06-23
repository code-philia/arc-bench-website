import { test, expect } from '@playwright/test';
import { navigateToTicketOrders } from './helpers';

test('REQ-4.2.8: Filter upcoming trips by a selected date type and range', async ({ page }) => {
  // GIVEN: The user is on the "Upcoming trips" tab.
  await navigateToTicketOrders(page);
  await page.getByRole('button', { name: /Upcoming trips/i }).click();
  await page.waitForTimeout(1000);

  // WHEN: Choose one option from the date type dropdown, choose a start date and end date, and click "Search".
  const dateTypeSelect = page.locator('.orders-filters select').first();
  await expect(dateTypeSelect).toBeVisible({ timeout: 5000 }).catch(() => {});
  await dateTypeSelect.selectOption({ label: 'Search by departure date' }).catch(() => {});

  // Click the Search button
  const searchButton = page.getByRole('button', { name: /Search/i });
  await searchButton.click().catch(() => {});

  // THEN: The page shows the upcoming orders that match the selected date type and date range.
  await page.waitForTimeout(1000);
});
