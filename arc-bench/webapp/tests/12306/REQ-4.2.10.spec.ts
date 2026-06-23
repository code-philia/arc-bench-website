import { test, expect } from '@playwright/test';
import { navigateToTicketOrders, createPaidOrder } from './helpers';

test('REQ-4.2.10: Display upcoming trips in a table', async ({ page }) => {
  // GIVEN: The user is on the "Upcoming trips" tab and there is at least one upcoming order.
  // Create a paid order first to ensure the precondition.
  await createPaidOrder(page);

  // Navigate to ticket orders
  await navigateToTicketOrders(page);
  await page.getByRole('button', { name: /Upcoming trips/i }).click();

  // WHEN: Observe the order table.
  // THEN: The page shows the columns for the upcoming trips.
  // Scope to the first order card to avoid matching text outside the order table.
  // Use exact regex anchors for column headers that are substrings of other headers (e.g. Price vs Total Price).
  const firstOrder = page.locator('.order-card').first();
  await expect(firstOrder.locator('strong', { hasText: /^Train Information$/ })).toBeVisible({ timeout: 5000 });
  await expect(firstOrder.locator('strong', { hasText: /^Passenger Information$/ })).toBeVisible();
  await expect(firstOrder.locator('strong', { hasText: /^Seat Information$/ })).toBeVisible();
  await expect(firstOrder.locator('strong', { hasText: /^Price$/ })).toBeVisible();
  await expect(firstOrder.locator('strong', { hasText: /^Status$/ })).toBeVisible();
  await expect(firstOrder.locator('strong', { hasText: /^Total Price$/ })).toBeVisible();
});
