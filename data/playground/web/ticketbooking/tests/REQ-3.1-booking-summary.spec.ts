import { expect, test } from '@playwright/test';
import {
  expectBookingSummary,
  expectSignedIn,
  openFirstBookableTrain,
  registerAccount,
  searchTrains,
  signOut,
  uniqueTicketBookingAccount,
} from './support/e2e';

test('REQ-3.1: open the booking page and display the selected train summary', async ({
  page,
}) => {
  const account = uniqueTicketBookingAccount();
  const criteria = {
    from: 'Shanghai',
    to: 'Beijing',
    date: 'Sun, May 31',
  };

  await registerAccount(page, account);
  await expectSignedIn(page, account.username);
  await searchTrains(page, criteria);
  await openFirstBookableTrain(page);

  await expectBookingSummary(page);
  await expect(page.getByText(/g532/i)).toBeVisible();
  await expect(page.getByText(/june 1, 2026|may 31|2026/i)).toBeVisible();
});

test('REQ-3.1: display booking summaries for multiple selected trains', async ({ page }) => {
  const account = uniqueTicketBookingAccount();
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

  await registerAccount(page, account);
  await expectSignedIn(page, account.username);

  for (const currentCase of cases) {
    await searchTrains(page, currentCase.criteria);
    await openFirstBookableTrain(page);
    await expectBookingSummary(page);
    await expect(page.getByText(currentCase.train)).toBeVisible();
    await expect(page.getByText(currentCase.criteria.from, { exact: false })).toBeVisible();
    await expect(page.getByText(currentCase.criteria.to, { exact: false })).toBeVisible();
  }
});

test('REQ-3.1: a signed-out visitor cannot use a selected journey to submit a booking', async ({ page }) => {
  const account = uniqueTicketBookingAccount();
  const criteria = { from: 'Shanghai', to: 'Beijing', date: 'Sun, May 31' };

  await registerAccount(page, account);
  await expectSignedIn(page, account.username);
  await signOut(page);
  await searchTrains(page, criteria);
  await openFirstBookableTrain(page);

  await expect(page.getByText(/sign in|login|required|unauthorized/i)).toBeVisible();
  const submitBooking = page.getByRole('button', { name: /place order|submit booking/i });
  if (await submitBooking.count()) {
    await expect(submitBooking).toBeDisabled();
  }
});
