import { test, expect } from '@playwright/test';
import { navigateToTicketOrders, createUnpaidOrder, navigateToHomePage } from './helpers';

test('REQ-4.2.4: Display uncompleted orders in a table', async ({ page }) => {
  // GIVEN: The user is on the "Uncompleted orders" tab and there is at least one uncompleted order.
  // Create an unpaid order first to ensure the precondition.
  await createUnpaidOrder(page);

  // Navigate to ticket orders
  await navigateToTicketOrders(page);
  // Click the "Uncompleted orders" tab button to ensure we're on the right tab
  const uncompletedTab = page.getByRole('button', { name: /Uncompleted orders/i });
  await expect(uncompletedTab).toBeVisible({ timeout: 10000 });
  await uncompletedTab.click().catch(() => {});
  await page.waitForTimeout(1000);

  // WHEN: Observe the order table.
  // THEN: The page shows the columns and each order group is followed by a "Pay" button.
  // Scope to the first order card to avoid matching text outside the order table.
  // Use exact regex anchors for column headers that are substrings of other headers (e.g. Price vs Total Price).
  const firstOrder = page.locator('.order-card').first();
  await expect(firstOrder).toBeVisible({ timeout: 10000 });
  await expect(firstOrder.locator('strong', { hasText: /^Train Information$/ })).toBeVisible({ timeout: 5000 });
  await expect(firstOrder.locator('strong', { hasText: /^Passenger Information$/ })).toBeVisible();
  await expect(firstOrder.locator('strong', { hasText: /^Seat Information$/ })).toBeVisible();
  await expect(firstOrder.locator('strong', { hasText: /^Price$/ })).toBeVisible();
  await expect(firstOrder.locator('strong', { hasText: /^Status$/ })).toBeVisible();
  await expect(firstOrder.locator('strong', { hasText: /^Total Price$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pay/i }).first()).toBeVisible();
});
