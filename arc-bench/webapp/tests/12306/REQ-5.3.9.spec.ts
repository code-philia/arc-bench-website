import { test, expect } from '@playwright/test';
import { navigateToTicketOrders, createUnpaidOrder } from './helpers';

test('REQ-5.3.9: Confirm cancellation of an unpaid order from the order center', async ({ page }) => {
  // GIVEN: The user is on the "Uncompleted orders" tab with at least one unpaid order.
  // Create an unpaid order first to ensure the precondition.
  await createUnpaidOrder(page);

  // Navigate to ticket orders
  await navigateToTicketOrders(page);
  await expect(page.getByText(/Uncompleted orders/i)).toBeVisible({ timeout: 10000 });

  // WHEN: Click the "Cancel" button for one order.
  const cancelButton = page.getByRole('button', { name: /Cancel/i }).first();
  await expect(cancelButton).toBeVisible({ timeout: 5000 });
  await cancelButton.click();

  // A confirmation dialog should appear.
  await expect(page.getByText(/Are you sure you want to cancel this order/i)).toBeVisible({ timeout: 5000 });

  // Click "Confirm" in the dialog.
  await page.locator('.modal-actions').getByRole('button', { name: /Confirm/i }).click();

  // THEN: The order is cancelled and the page shows a successful cancellation message.
  await expect(page.getByText(/success|Cancellation successful/i).or(page.getByText(/Cancelled/).first())).toBeVisible({ timeout: 10000 });
});

test('REQ-5.3.9: Cancel the cancellation action from the order center dialog', async ({ page }) => {
  // GIVEN: The user is on the "Uncompleted orders" tab with at least one unpaid order.
  // Create an unpaid order first to ensure the precondition.
  await createUnpaidOrder(page);

  // Navigate to ticket orders
  await navigateToTicketOrders(page);
  await expect(page.getByText(/Uncompleted orders/i)).toBeVisible({ timeout: 10000 });

  // Click "Cancel" button to open the dialog.
  const cancelButton = page.getByRole('button', { name: /Cancel/i }).first();
  await expect(cancelButton).toBeVisible({ timeout: 5000 });
  await cancelButton.click();

  // WHEN: Click the "Cancel" button in the dialog (dismiss the dialog).
  await page.locator('.modal-actions').getByRole('button', { name: /Cancel/i }).click();

  // THEN: The dialog closes and the order remains unchanged.
  await expect(page.getByText(/Are you sure you want to cancel this order/i)).not.toBeVisible({ timeout: 5000 });
});
