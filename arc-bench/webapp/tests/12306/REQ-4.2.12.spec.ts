import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToHomePage } from './helpers';

test('REQ-4.2.12: Open upcoming trips from the booking dropdown', async ({ page }) => {
  // GIVEN: The user is on the home page.
  await loginAsTestUser(page);
  await navigateToHomePage(page);

  // WHEN: Open the "Booking" dropdown in the navigation bar and click the "Refund" option.
  await page.locator('.main-nav').getByText(/Booking/i).hover();
  await page.locator('.nav-menu').getByRole('link', { name: /Refund/i }).click();

  // THEN: Navigate directly to the personal center order center and show the "Upcoming trips" page.
  await expect(page.getByRole('button', { name: /Upcoming trips/i })).toBeVisible({ timeout: 10000 });
});
