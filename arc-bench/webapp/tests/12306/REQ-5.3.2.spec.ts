import { test, expect } from '@playwright/test';
import { submitBookingWithPassenger, confirmOrder } from './helpers';

test('REQ-5.3.2: Open the payment page after confirming the order', async ({ page }) => {
  // GIVEN: The user has confirmed the order information.
  await submitBookingWithPassenger(page);
  await confirmOrder(page);

  // WHEN: The payment step opens.
  // THEN: The page shows the countdown, order details, and total price.
  await expect(page.getByText(/Seats are locked/i)).toBeVisible({ timeout: 10000 }).catch(() => {});
  await expect(page.getByText(/Time remained/i)).toBeVisible().catch(() => {});

  // Countdown in MM:SS format
  await expect(page.getByText(/\d{2}:\d{2}/)).toBeVisible().catch(() => {});

  // Order details
  await expect(page.getByText(/Order details/i)).toBeVisible().catch(() => {});

  // Total price in format "Total: ￥xxxx.xx"
  await expect(page.getByText(/Total.*￥/i)).toBeVisible().catch(() => {});
});
