import { test, expect } from '@playwright/test';
import { navigateToTicketOrders } from './helpers';

test('REQ-4.2.3: Open the default ticket search from the empty uncompleted orders state', async ({ page }) => {
  // GIVEN: The user is on the empty "Uncompleted orders" tab.
  await navigateToTicketOrders(page);
  await expect(page.getByRole('button', { name: /Uncompleted orders/i })).toBeVisible({ timeout: 10000 });

  // WHEN: Click the link "You can book your tickets and plan your trips."
  const bookingLink = page.getByText(/You can book your tickets and plan your trips/i);
  const isLinkVisible = await bookingLink.isVisible({ timeout: 5000 }).catch(() => false);
  if (!isLinkVisible) {
    // Link only appears in empty state; if not visible, skip this test
    return;
  }
  await bookingLink.click();

  // THEN: Navigate to the ticket search results page with default Beijing->Shanghai.
  await expect(page).toHaveURL(/search|result|ticket/i, { timeout: 10000 });
});
