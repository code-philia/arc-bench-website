import { test, expect } from '@playwright/test';
import { submitBookingWithPassenger, confirmOrder } from './helpers';

test('REQ-5.3.4: Complete payment from the payment page', async ({ page }) => {
  // GIVEN: The user is on the payment page for an unpaid order.
  await submitBookingWithPassenger(page);
  await confirmOrder(page);
  // Wait for payment page to load
  await page.waitForTimeout(2000);

  // WHEN: Click the "Pay" button.
  const payButton = page.getByRole('button', { name: /Pay/i }).first();
  await expect(payButton).toBeVisible({ timeout: 10000 });
  await payButton.click();

  // THEN: The system simulates a successful payment.
  await expect(page.getByText(/success|Payment successful|paid/i)).toBeVisible({ timeout: 10000 });
});
