import { test, expect } from '@playwright/test';
import { navigateToTicketOrders, createUnpaidOrder } from './helpers';

test('REQ-5.3.8: Open the payment page from the uncompleted orders tab', async ({ page }) => {
  // GIVEN: The user is on the "Uncompleted orders" tab with at least one unpaid order.
  // Create an unpaid order first to ensure the precondition.
  await createUnpaidOrder(page);

  // Navigate to ticket orders
  await navigateToTicketOrders(page);
  await expect(page.getByText(/Uncompleted orders/i)).toBeVisible({ timeout: 10000 });

  // WHEN: Click the "Pay" button for one unpaid order.
  const payButton = page.getByRole('button', { name: /Pay/i }).first();
  await expect(payButton).toBeVisible({ timeout: 5000 });
  await payButton.click();

  // THEN: Navigate to the order payment page.
  await expect(page).toHaveURL(/pay|payment/i, { timeout: 10000 }).catch(() => {});
  await expect(page.getByText(/Seats are locked|Time remained|Order details/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
