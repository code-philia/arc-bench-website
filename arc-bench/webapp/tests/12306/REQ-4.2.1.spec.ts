import { test, expect } from '@playwright/test';
import { navigateToTicketOrders } from './helpers';

test('REQ-4.2.1: Open the ticket orders page from the order center menu', async ({ page }) => {
  // GIVEN: The user is on the personal center home page.
  // WHEN: Click "Order center" and then click "Ticket orders".
  await navigateToTicketOrders(page);

  // THEN: The page shows the ticket orders view with the tabs.
  await expect(page.getByRole('button', { name: /Uncompleted orders/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /Upcoming trips/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /History orders/i })).toBeVisible();
});
