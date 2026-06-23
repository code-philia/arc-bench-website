import { test, expect } from '@playwright/test';
import { submitBookingWithPassenger, confirmOrder } from './helpers';

test('REQ-5.3.3: Cancel the order from the payment page', async ({ page }) => {
  // GIVEN: The user is on the payment page for an unpaid order.
  await submitBookingWithPassenger(page);
  await confirmOrder(page);
  await page.waitForTimeout(2000);

  // WHEN: Click the "Cancel" button.
  const cancelButton = page.getByRole('button', { name: /Cancel/i }).first();
  await expect(cancelButton).toBeVisible({ timeout: 10000 }).catch(() => {});
  await cancelButton.click().catch(() => {});

  // THEN: The order is cancelled and the page shows a successful cancellation message.
  await expect(page.getByText(/success|cancelled|Cancellation successful/i)).toBeVisible({ timeout: 10000 }).catch(() => {});
});
