import { test, expect } from '@playwright/test';
import { openBookingForm, selectFirstPassengerOnBookingForm } from './helpers';

test('REQ-5.2.7: Submit the booking form with an unavailable ticket class', async ({ page }) => {
  // GIVEN: The user is on the booking form page with at least one passenger selected
  // and one selected ticket class having no remaining tickets.
  await openBookingForm(page);
  // Wait for the booking form to fully load
  await expect(page.locator('.booking-passenger-chip').first()).toBeVisible({ timeout: 10000 });
  await selectFirstPassengerOnBookingForm(page);
  // Wait for the passenger row to appear
  await expect(page.locator('.booking-passenger-table tbody tr').first()).toBeVisible({ timeout: 5000 });

  // Change the ticket class to one with no remaining tickets.
  // The ticket class select is the first <select> inside the passenger table.
  const ticketClassSelect = page.locator('.booking-passenger-table select').first();
  // Select "business-class seat" or "first-class seat" which have 0 tickets
  await ticketClassSelect.selectOption('business-class seat').catch(async () => {
    await ticketClassSelect.selectOption('first-class seat').catch(() => {});
  });

  // WHEN: Click the "Place order" button.
  await page.getByRole('button', { name: /Place order/i }).click();

  // THEN: The page shows "Sorry, there are no tickets available for the selected ticket class."
  await expect(page.getByText(/Sorry, there are no tickets available for the selected ticket class/i)).toBeVisible({ timeout: 5000 });
});
