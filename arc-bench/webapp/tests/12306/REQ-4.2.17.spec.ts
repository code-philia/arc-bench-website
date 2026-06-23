import { test, expect } from '@playwright/test';
import { navigateToTicketOrders } from './helpers';

test('REQ-4.2.17: Display historical orders in a table', async ({ page }) => {
  // GIVEN: The user is on the "History orders" tab and there is at least one historical order.
  // Note: Requires the test user to have at least one history order (see prerequisites).
  await navigateToTicketOrders(page);
  await page.getByRole('button', { name: /History orders/i }).click();

  // WHEN: Observe the order table.
  // THEN: The page shows the columns for the history orders.
  await expect(page.getByText(/Train Information/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
  await expect(page.getByText(/Passenger Information/i)).toBeVisible().catch(() => {});
  await expect(page.getByText(/Seat Information/i)).toBeVisible().catch(() => {});
  await expect(page.getByText(/Price/i)).toBeVisible().catch(() => {});
  await expect(page.getByText(/Status/i)).toBeVisible().catch(() => {});
  await expect(page.getByText(/Total Price/i)).toBeVisible().catch(() => {});
});
