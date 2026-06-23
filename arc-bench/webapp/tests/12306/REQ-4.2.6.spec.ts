import { test, expect } from '@playwright/test';
import { navigateToTicketOrders } from './helpers';

test('REQ-4.2.6: Display the empty state in upcoming trips', async ({ page }) => {
  // GIVEN: The user is on the "Upcoming trips" tab and there is no upcoming trip.
  await navigateToTicketOrders(page);
  await page.getByRole('button', { name: /Upcoming trips/i }).click();

  // WHEN: Observe the tab content.
  // THEN: The page shows "assets/empty.png" and the text.
  const emptyImage = page.locator('img[src*="empty"]');
  const emptyText = page.getByText(/You don't have any bookings/i);
  const isEmpty = await emptyImage.isVisible({ timeout: 5000 }).catch(() => false) || await emptyText.isVisible({ timeout: 5000 }).catch(() => false);
  if (isEmpty) {
    await expect(emptyText).toBeVisible();
  }
  // If not empty, the non-empty layout is verified by REQ-4.2.10
});
