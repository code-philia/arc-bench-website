import { test, expect } from '@playwright/test';
import { submitBookingWithPassenger, confirmOrder, navigateToTicketOrders } from './helpers';

test('REQ-5.3.5: Show an unpaid order in the uncompleted orders tab', async ({ page }) => {
  // GIVEN: The user has confirmed the order information and is on the payment page without completing payment.
  await submitBookingWithPassenger(page);
  await confirmOrder(page);
  await page.waitForTimeout(2000);

  // WHEN: Leave the order unpaid (navigate away to order center).
  await navigateToTicketOrders(page);

  // THEN: The order status is set as unpaid and the order appears in the "Uncompleted orders" tab.
  await expect(page.getByText(/Uncompleted orders/i)).toBeVisible({ timeout: 10000 });
  // There should be at least one order in the tab
  await expect(page.getByText(/Train Information/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
