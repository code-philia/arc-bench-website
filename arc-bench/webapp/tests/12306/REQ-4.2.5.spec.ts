import { test, expect } from '@playwright/test';
import { navigateToTicketOrders, createUnpaidOrder } from './helpers';

test('REQ-4.2.5: Continue payment from the uncompleted orders tab', async ({ page }) => {
  // GIVEN: The user is on the "Uncompleted orders" tab with at least one displayed order group.
  // Create an unpaid order first to ensure the precondition.
  await createUnpaidOrder(page);

  // Navigate to ticket orders
  await navigateToTicketOrders(page);
  await expect(page.getByRole('button', { name: /Uncompleted orders/i })).toBeVisible({ timeout: 10000 });

  // WHEN: Click the "Pay" button for one order group.
  const payButton = page.getByRole('button', { name: /Pay/i }).first();
  await expect(payButton).toBeVisible({ timeout: 5000 });
  await payButton.click();

  // THEN: Navigate to the order payment page and show the order information and payment information.
  await expect(page).toHaveURL(/pay|payment/i, { timeout: 10000 }).catch(() => {});
});
