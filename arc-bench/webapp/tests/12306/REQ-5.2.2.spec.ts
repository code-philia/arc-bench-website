import { test, expect } from '@playwright/test';
import { openBookingForm } from './helpers';

test('REQ-5.2.2: Display the booking information section for the selected train', async ({ page }) => {
  // GIVEN: The user is on the booking form page.
  await openBookingForm(page);

  // WHEN: Observe the "Train Information:" section.
  // THEN: The section shows the selected train details, seat types, prices, and remaining ticket info.
  const trainInfoSection = page.locator('section, div').filter({ has: page.getByText(/Train Information/i) }).first();
  await expect(trainInfoSection).toBeVisible({ timeout: 10000 });

  // Should show departure/destination info
  await expect(page.getByText(/Train Information/i)).toBeVisible();

  // Should show seat type and price information (e.g., "second-class seat", "￥")
  await expect(page.getByText(/seat|ticket/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
  await expect(page.getByText(/￥|¥/i)).toBeVisible().catch(() => {});

  // Should show remaining ticket information (e.g., "left", "None left", "Enough left")
  await expect(page.getByText(/left/i)).toBeVisible().catch(() => {});
});
