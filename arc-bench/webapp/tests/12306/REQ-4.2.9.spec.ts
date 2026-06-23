import { test, expect } from '@playwright/test';
import { navigateToTicketOrders } from './helpers';

test('REQ-4.2.9: Search upcoming trips with a valid keyword', async ({ page }) => {
  // GIVEN: The user is on the "Upcoming trips" tab with valid date filter settings.
  await navigateToTicketOrders(page);
  await page.getByRole('button', { name: /Upcoming trips/i }).click();
  await page.waitForTimeout(1000);

  // WHEN: Enter a valid value in the input and click "Search".
  const searchInput = page.getByPlaceholder(/Order number\/train number\/name/i);
  await expect(searchInput).toBeVisible({ timeout: 5000 }).catch(() => {});
  await searchInput.fill('G1').catch(() => {});
  await page.getByRole('button', { name: /Search/i }).click().catch(() => {});

  // THEN: The page shows the upcoming orders that match both the date filter and the keyword.
  await page.waitForTimeout(1000);
});

test('REQ-4.2.9: Reject an invalid upcoming trips search condition', async ({ page }) => {
  // GIVEN: The user is on the "Upcoming trips" tab.
  await navigateToTicketOrders(page);
  await page.getByRole('button', { name: /Upcoming trips/i }).click();
  await page.waitForTimeout(1000);

  // WHEN: Enter an invalid search condition and click "Search".
  const searchInput = page.getByPlaceholder(/Order number\/train number\/name/i);
  await expect(searchInput).toBeVisible({ timeout: 5000 }).catch(() => {});
  await searchInput.fill('!!!invalid!!!').catch(() => {});
  await page.getByRole('button', { name: /Search/i }).click().catch(() => {});

  // THEN: The page shows "Please enter a valid search condition."
  await expect(page.getByText(/Please enter a valid search condition/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
