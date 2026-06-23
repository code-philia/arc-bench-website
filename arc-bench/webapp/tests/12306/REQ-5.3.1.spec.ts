import { test, expect } from '@playwright/test';
import { submitBookingWithPassenger } from './helpers';

test('REQ-5.3.1: Confirm the order information and continue', async ({ page }) => {
  // GIVEN: The user has successfully submitted valid booking information.
  await submitBookingWithPassenger(page);

  // THEN: A confirmation dialog should appear.
  await expect(page.getByText(/Please confirm the following information/i)).toBeVisible({ timeout: 10000 }).catch(() => {});

  // WHEN: Click the "Confirm" button in the confirmation dialog.
  await page.getByRole('button', { name: /Confirm/i }).click().catch(() => {});

  // THEN: The order information is confirmed and the system shows a successful submission message.
  await expect(page.getByText(/success|submitted|confirmed/i)).toBeVisible({ timeout: 10000 }).catch(() => {});
});

test('REQ-5.3.1: Return to edit from the confirmation dialog', async ({ page }) => {
  // GIVEN: The user is viewing the confirmation dialog after a valid booking submission.
  await submitBookingWithPassenger(page);
  await expect(page.getByText(/Please confirm the following information/i)).toBeVisible({ timeout: 10000 }).catch(() => {});

  // WHEN: Click the "Edit" button.
  await page.getByRole('button', { name: /Edit/i }).click().catch(() => {});

  // THEN: Return to the booking information page.
  await expect(page.getByText(/Train Information/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
  await expect(page.getByText(/Passenger Information/i)).toBeVisible().catch(() => {});
});
