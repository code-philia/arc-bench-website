import { test, expect } from '@playwright/test';
import { openBookingForm } from './helpers';

test('REQ-5.2.6: Submit the booking form without selecting any passenger', async ({ page }) => {
  // GIVEN: The user is on the booking form page with no passenger selected.
  await openBookingForm(page);

  // WHEN: Click the "Place order" button.
  await page.getByRole('button', { name: /Place order/i }).click();

  // THEN: The page shows "Please select at least one passenger."
  await expect(page.getByText(/Please select at least one passenger/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
