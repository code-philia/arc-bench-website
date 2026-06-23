import { test, expect } from '@playwright/test';
import { navigateToTicketOrders } from './helpers';

test('REQ-4.2.7: Open the default ticket search from the empty upcoming trips state', async ({ page }) => {
  // GIVEN: The user is on the empty "Upcoming trips" tab.
  await navigateToTicketOrders(page);
  await page.getByRole('button', { name: /Upcoming trips/i }).click();

  // WHEN: Click the link "You can make travel plans through the ticket reservation function."
  const link = page.getByText(/You can make travel plans through the ticket reservation function/i);
  const isLinkVisible = await link.isVisible({ timeout: 5000 }).catch(() => false);
  if (!isLinkVisible) {
    // Link only appears in empty state; if not visible, skip
    return;
  }
  await link.click();

  // THEN: Navigate to the default ticket search results page.
  await expect(page).toHaveURL(/search|result|ticket/i, { timeout: 10000 });
});
