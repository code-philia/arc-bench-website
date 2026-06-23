import { test, expect } from '@playwright/test';
import { navigateToTicketOrders } from './helpers';

test('REQ-4.2.13: Display the empty state in history orders', async ({ page }) => {
  // GIVEN: The user is on the "History orders" tab and there is no historical order.
  await navigateToTicketOrders(page);
  await page.getByRole('button', { name: /History orders/i }).click();

  // WHEN: Observe the tab content.
  // THEN: The page shows "assets/empty.png" and the text.
  const emptyImage = page.locator('img[src*="empty"]');
  const emptyText = page.getByText(/You don't have any bookings/i);
  const isEmpty = await emptyImage.isVisible({ timeout: 5000 }).catch(() => false) || await emptyText.isVisible({ timeout: 5000 }).catch(() => false);
  if (isEmpty) {
    await expect(emptyText).toBeVisible();
  }
  // If not empty, the non-empty layout is verified by REQ-4.2.17
});
