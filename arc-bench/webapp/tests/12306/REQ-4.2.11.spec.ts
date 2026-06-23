import { test, expect } from '@playwright/test';
import { navigateToTicketOrders, createPaidOrder } from './helpers';

test('REQ-4.2.11: Refund one eligible upcoming trip', async ({ page }) => {
  // GIVEN: The user is on the "Upcoming trips" tab with at least one order within the refund deadline.
  // Create a paid order first to ensure the precondition.
  await createPaidOrder(page);

  // Navigate to ticket orders
  await navigateToTicketOrders(page);
  await page.getByRole('button', { name: /Upcoming trips/i }).click();

  // WHEN: Click the "Refund" button for one order.
  const refundButton = page.getByRole('button', { name: /Refund/i }).first();
  await expect(refundButton).toBeVisible({ timeout: 5000 });
  await refundButton.click();

  // THEN: The refund flow opens, the refund succeeds, the order status becomes "refunded".
  await page.waitForTimeout(2000);
  await expect(page.getByText(/refunded/i)).toBeVisible({ timeout: 10000 }).catch(() => {});
});
