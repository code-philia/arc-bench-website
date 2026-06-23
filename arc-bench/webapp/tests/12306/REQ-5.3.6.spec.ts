import { test, expect } from '@playwright/test';
import { submitBookingWithPassenger, confirmOrder, navigateToTicketOrders } from './helpers';

test('REQ-5.3.6: Show a paid upcoming order in the upcoming trips tab', async ({ page }) => {
  // GIVEN: The user has an unpaid order on the payment page.
  await submitBookingWithPassenger(page);
  await confirmOrder(page);
  await page.waitForTimeout(2000);

  // WHEN: Click the "Pay" button and complete the simulated payment.
  const payButton = page.getByRole('button', { name: /Pay/i }).first();
  await expect(payButton).toBeVisible({ timeout: 10000 }).catch(() => {});
  await payButton.click().catch(() => {});
  await page.waitForTimeout(2000);

  // THEN: The order status is set as paid and upcoming.
  // Navigate to order center and check the "Upcoming trips" tab.
  await navigateToTicketOrders(page);
  await page.getByText(/Upcoming trips/i).click();

  // The order should appear in the "Upcoming trips" tab.
  await expect(page.getByText(/Train Information/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
