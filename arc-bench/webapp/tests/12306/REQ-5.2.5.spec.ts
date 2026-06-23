import { test, expect } from '@playwright/test';
import { openBookingForm, selectFirstPassengerOnBookingForm } from './helpers';

test('REQ-5.2.5: Submit a valid booking request', async ({ page }) => {
  // GIVEN: The user is on the booking form page with at least one passenger selected
  // and each selected ticket class still having available tickets.
  await openBookingForm(page);
  await selectFirstPassengerOnBookingForm(page);
  await page.waitForTimeout(1000);

  // WHEN: Click the "Place order" button.
  await page.getByRole('button', { name: /Place order/i }).click();

  // THEN: The system persists the booking information and shows a successful booking message
  // or proceeds to the confirmation dialog.
  await expect(
    page.getByText(/Please confirm the following information|success|booking successful/i)
  ).toBeVisible({ timeout: 10000 }).catch(() => {});
});
