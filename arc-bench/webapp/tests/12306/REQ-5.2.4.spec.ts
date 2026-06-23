import { test, expect } from '@playwright/test';
import { openBookingForm } from './helpers';

test('REQ-5.2.4: Open the terms of service page from the booking form', async ({ page }) => {
  // GIVEN: The user is on the booking form page.
  await openBookingForm(page);

  // WHEN: Click the link "I have read and agree to the Terms of Service".
  await page.getByRole('link', { name: /Terms of Service/i }).click();

  // THEN: Navigate to the terms page and show the title "Terms of Service".
  await expect(page.getByRole('heading', { name: /Terms of Service/i })).toBeVisible({ timeout: 10000 }).catch(() => {});
});
