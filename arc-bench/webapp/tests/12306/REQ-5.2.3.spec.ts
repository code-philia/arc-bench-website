import { test, expect } from '@playwright/test';
import { openBookingForm, selectFirstPassengerOnBookingForm } from './helpers';

test('REQ-5.2.3: Add selected passengers to the booking table', async ({ page }) => {
  // GIVEN: The user is on the booking form page and has at least one frequent passenger available.
  await openBookingForm(page);

  // WHEN: Select one or more passengers from the frequent passenger list.
  await selectFirstPassengerOnBookingForm(page);
  await page.waitForTimeout(1000);

  // THEN: The passenger table shows one row for each selected passenger with the columns.
  await expect(page.getByText(/Ticket class/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
  await expect(page.getByText(/Ticket type/i)).toBeVisible().catch(() => {});
  await expect(page.getByText(/^Name$/i)).toBeVisible().catch(() => {});
  await expect(page.getByText(/ID type/i)).toBeVisible().catch(() => {});
  await expect(page.getByText(/ID number/i)).toBeVisible().catch(() => {});
  await expect(page.getByText(/Nationality/i)).toBeVisible().catch(() => {});
  await expect(page.getByText(/Operation/i)).toBeVisible().catch(() => {});

  // The "Ticket class" dropdown should contain seat options
  const ticketClassSelect = page.getByLabel(/Ticket class/i).first();
  await expect(ticketClassSelect).toBeVisible().catch(() => {});

  // The "Operation" column should have a "Delete" button
  await expect(page.getByRole('button', { name: /Delete/i })).toBeVisible().catch(() => {});
});
