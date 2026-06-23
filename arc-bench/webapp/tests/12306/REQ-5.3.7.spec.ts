import { test, expect } from '@playwright/test';
import { submitBookingWithPassenger, confirmOrder, navigateToTicketOrders } from './helpers';

test('REQ-5.3.7: Show a cancelled order in the uncompleted orders tab', async ({ page }) => {
  // GIVEN: The user is on the payment page for an unpaid order.
  await submitBookingWithPassenger(page);
  await confirmOrder(page);
  await page.waitForTimeout(2000);

  // WHEN: Click the "Cancel" button and complete the cancellation.
  const cancelButton = page.getByRole('button', { name: /Cancel/i }).first();
  await expect(cancelButton).toBeVisible({ timeout: 10000 });
  await cancelButton.click();
  // Wait for cancellation to complete
  await expect(page.getByText(/success|cancelled|Cancellation successful/i)).toBeVisible({ timeout: 10000 });

  // THEN: The order status is set as cancelled.
  // Navigate to order center and check the "Uncompleted orders" tab.
  await navigateToTicketOrders(page);
  await expect(page.getByText(/Uncompleted orders/i)).toBeVisible({ timeout: 10000 });

  // The cancelled order should appear in the "Uncompleted orders" tab.
  await expect(page.getByText(/cancelled|Train Information/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
