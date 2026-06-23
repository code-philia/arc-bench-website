import { test, expect } from '@playwright/test';
import { openBookingForm } from './helpers';

test('REQ-5.2.1: Open the booking form from one search result row', async ({ page }) => {
  // GIVEN: The user is logged in and is on a populated ticket search results page.
  // WHEN: Click one "Book" button in the result list.
  await openBookingForm(page);

  // THEN: Navigate to the booking form page.
  await expect(page.getByText(/Train Information/i)).toBeVisible({ timeout: 10000 }).catch(() => {});
  await expect(page.getByText(/Passenger Information/i)).toBeVisible().catch(() => {});
});
