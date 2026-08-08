import { expect, test } from '@playwright/test';
import { baseUrl, openFirstBookableTrain, searchTrains } from './support/e2e';

test('REQ-2.3: select a train from the result list and open the booking page', async ({
  page,
}) => {
  const criteria = {
    from: 'Shanghai',
    to: 'Beijing',
    date: 'Sun, May 31',
  };

  await searchTrains(page, criteria);
  await openFirstBookableTrain(page);

  await expect(page.getByText(/train information/i)).toBeVisible();
  await expect(page.getByText(/g532/i)).toBeVisible();
  await expect(page.getByText(/shanghaihongqiao|shanghai/i)).toBeVisible();
  await expect(page.getByText(/beijingnan|beijing/i)).toBeVisible();
});

test('REQ-2.3: open the booking page from multiple bookable routes', async ({ page }) => {
  const cases = [
    {
      criteria: { from: 'Shanghai', to: 'Beijing', date: 'Sun, May 31' },
      train: /g532/i,
    },
    {
      criteria: { from: 'Beijing', to: 'Tianjin', date: 'Sun, May 31' },
      train: /g561/i,
    },
  ];

  for (const currentCase of cases) {
    await searchTrains(page, currentCase.criteria);
    await openFirstBookableTrain(page);

    await expect(page.getByText(/train information/i)).toBeVisible();
    await expect(page.getByText(currentCase.train)).toBeVisible();
    await expect(page.getByText(currentCase.criteria.from, { exact: false })).toBeVisible();
    await expect(page.getByText(currentCase.criteria.to, { exact: false })).toBeVisible();
  }
});

test('REQ-2.3: block entry when the booking target does not exist', async ({ page }, testInfo) => {
  const invalidPath = process.env.E2E_TICKETBOOKING_INVALID_BOOKING_PATH;
  testInfo.skip(
    !invalidPath,
    'Set E2E_TICKETBOOKING_INVALID_BOOKING_PATH to run the non-existent train scenario.',
  );

  const targetUrl = invalidPath!.startsWith('http')
    ? invalidPath!
    : new URL(invalidPath!, baseUrl()).toString();

  await page.goto(targetUrl);
  await expect(page.getByText(/not found|expired|not bookable|missing context/i)).toBeVisible();
});
