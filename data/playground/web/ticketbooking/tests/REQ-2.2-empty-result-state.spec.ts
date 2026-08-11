import { expect, test } from '@playwright/test';
import { requiredEnv, searchTrains } from './support/e2e';

test('REQ-2.2: preserve criteria and show an empty state when no trains match', async ({
  page,
}, testInfo) => {
  const criteria = {
    from: requiredEnv(testInfo, 'E2E_TICKETBOOKING_EMPTY_FROM'),
    to: requiredEnv(testInfo, 'E2E_TICKETBOOKING_EMPTY_TO'),
    date: requiredEnv(testInfo, 'E2E_TICKETBOOKING_EMPTY_DATE'),
  };

  await searchTrains(page, criteria);
  await expect(page.getByText(criteria.from, { exact: false })).toBeVisible();
  await expect(page.getByText(criteria.to, { exact: false })).toBeVisible();
  await expect(page.getByText(criteria.date, { exact: false })).toBeVisible();
  await expect(page.getByText(/no results|0 results|no trains|empty/i)).toBeVisible();

  await page.reload();
  await expect(page.getByText(criteria.from, { exact: false })).toBeVisible();
  await expect(page.getByText(criteria.to, { exact: false })).toBeVisible();
  await expect(page.getByText(criteria.date, { exact: false })).toBeVisible();
  await expect(page.getByText(/no results|0 results|no trains|empty/i)).toBeVisible();
});
