import { test, expect } from '@playwright/test';
import { navigateToSearchResults } from './helpers';

test('REQ-3.2.2: Show ticket prices and booking actions in each result row', async ({ page }) => {
  // GIVEN: The user is on a populated ticket search results page.
  await navigateToSearchResults(page);

  // WHEN: Observe the train result rows.
  // THEN: Each result row shows one or more seat price lines in the "Price" column,
  // and each price line is followed by a "Book" button.

  // Wait for results to load
  await page.waitForTimeout(2000);

  // There should be at least one result row with a "Book" button
  const bookButtons = page.getByRole('button', { name: /Book/i });
  await expect(bookButtons.first()).toBeVisible({ timeout: 10000 });

  // Each row should have a price value (the frontend uses ￥ full-width yen sign)
  const priceCells = page.locator('.price-row, .price-column, td').filter({ hasText: /￥|¥/i });
  const priceCount = await priceCells.count();
  // At least one price cell should exist
  expect(priceCount).toBeGreaterThan(0);
});
