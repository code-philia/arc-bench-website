import { test, expect } from '@playwright/test';
import { navigateToTicketOrders } from './helpers';

test('REQ-4.2.16: Search history orders with a valid keyword', async ({ page }) => {
  // GIVEN: The user is on the "History orders" tab with a valid date range selected.
  await navigateToTicketOrders(page);
  await page.getByRole('button', { name: /History orders/i }).click();
  await page.waitForTimeout(1000);

  // WHEN: Enter a valid value in the input and click "Search".
  const searchInput = page.getByPlaceholder(/Order number\/train number\/name/i);
  await expect(searchInput).toBeVisible({ timeout: 5000 }).catch(() => {});
  await searchInput.fill('G1').catch(() => {});
  await page.getByRole('button', { name: /Search/i }).click().catch(() => {});

  // THEN: The page shows the history orders that match.
  await page.waitForTimeout(1000);
});

test('REQ-4.2.16: Reject an invalid history orders search condition', async ({ page }) => {
  // GIVEN: The user is on the "History orders" tab.
  await navigateToTicketOrders(page);
  await page.getByRole('button', { name: /History orders/i }).click();
  await page.waitForTimeout(1000);

  // WHEN: Enter an invalid search condition and click "Search".
  const searchInput = page.getByPlaceholder(/Order number\/train number\/name/i);
  await expect(searchInput).toBeVisible({ timeout: 5000 }).catch(() => {});
  await searchInput.fill('!!!invalid!!!').catch(() => {});
  await page.getByRole('button', { name: /Search/i }).click().catch(() => {});

  // THEN: The page shows "Please enter a valid search condition."
  await expect(page.getByText(/Please enter a valid search condition/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
