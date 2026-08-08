import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  expectBookingSummary,
  expectSignedIn,
  openFirstBookableTrain,
  registerAccount,
  searchTrains,
  uniqueTicketBookingAccount,
} from './support/e2e';

type BookingInput = {
  criteria: {
    from: string;
    to: string;
    date: string;
  };
  passenger: {
    name: string;
    idNumber: string;
    nationality: string;
  };
  ticketClass: string;
};

async function openBookingPage(page: Page, criteria: BookingInput['criteria']): Promise<void> {
  await searchTrains(page, criteria);
  await openFirstBookableTrain(page);
  await expectBookingSummary(page);
}

async function fillBookingForm(
  page: Page,
  ticketClass: string,
  passenger: BookingInput['passenger'],
  options: { acceptTerms?: boolean } = {},
): Promise<void> {
  await page.getByRole('combobox', { name: /ticket class/i }).selectOption({ label: ticketClass });
  await page.getByRole('combobox', { name: /ticket type/i }).selectOption({ label: 'Adult' });
  await page.getByRole('textbox', { name: /^name$/i }).fill(passenger.name);
  await page.getByRole('textbox', { name: /id number/i }).fill(passenger.idNumber);
  await page.getByRole('textbox', { name: /nationality/i }).fill(passenger.nationality);
  if (options.acceptTerms !== false) {
    await page.getByRole('checkbox', { name: /terms of service/i }).check();
  }
}

test('REQ-3.2: submit valid passenger information and create a booking record', async ({
  page,
}) => {
  const account = uniqueTicketBookingAccount();
  const criteria = {
    from: 'Shanghai',
    to: 'Beijing',
    date: 'Sun, May 31',
  };
  const passenger = {
    name: 'Nguyen Duc Minh',
    idNumber: 'C612345677',
    nationality: 'Vietnam',
  };

  await registerAccount(page, account);
  await expectSignedIn(page, account.username);
  await searchTrains(page, criteria);
  await openFirstBookableTrain(page);
  await expectBookingSummary(page);

  await page.getByRole('combobox', { name: /ticket class/i }).selectOption({ label: 'standing ticket' });
  await page.getByRole('combobox', { name: /ticket type/i }).selectOption({ label: 'Adult' });
  await page.getByRole('textbox', { name: /^name$/i }).fill(passenger.name);
  await page.getByRole('textbox', { name: /id number/i }).fill(passenger.idNumber);
  await page.getByRole('textbox', { name: /nationality/i }).fill(passenger.nationality);
  await page.getByRole('checkbox', { name: /terms of service/i }).check();
  await page.getByRole('button', { name: /place order/i }).click();

  await expect(page.getByText(/please confirm the following information/i)).toBeVisible();
  await page.getByRole('button', { name: /confirm/i }).click();
  await expect(page.getByText(/booking number|order number|success|confirmed/i)).toBeVisible();
  await expect(page.getByText(passenger.name, { exact: false })).toBeVisible();
});

test('REQ-3.2: create bookings across supported route and seat combinations', async ({ page }) => {
  const cases: BookingInput[] = [
    {
      criteria: { from: 'Shanghai', to: 'Beijing', date: 'Sun, May 31' },
      passenger: {
        name: 'Nguyen Duc Minh',
        idNumber: 'C612345677',
        nationality: 'Vietnam',
      },
      ticketClass: 'standing ticket',
    },
    {
      criteria: { from: 'Beijing', to: 'Tianjin', date: 'Sun, May 31' },
      passenger: {
        name: 'Chen Li',
        idNumber: 'D712345678',
        nationality: 'Vietnam',
      },
      ticketClass: 'Business Class',
    },
  ];

  for (const currentCase of cases) {
    const account = uniqueTicketBookingAccount();

    await registerAccount(page, account);
    await expectSignedIn(page, account.username);
    await openBookingPage(page, currentCase.criteria);
    await fillBookingForm(page, currentCase.ticketClass, currentCase.passenger);
    await page.getByRole('button', { name: /place order/i }).click();

    await expect(page.getByText(/please confirm the following information/i)).toBeVisible();
    await page.getByRole('button', { name: /confirm/i }).click();
    await expect(page.getByText(/booking number|order number|success|confirmed/i)).toBeVisible();
    await expect(page.getByText(currentCase.passenger.name, { exact: false })).toBeVisible();
    await expect(page.getByText(currentCase.ticketClass, { exact: false })).toBeVisible();
  }
});

test('REQ-3.2: reject invalid passenger information without creating a booking', async ({
  page,
}) => {
  const account = uniqueTicketBookingAccount();
  const criteria = {
    from: 'Shanghai',
    to: 'Beijing',
    date: 'Sun, May 31',
  };

  await registerAccount(page, account);
  await searchTrains(page, criteria);
  await openFirstBookableTrain(page);
  await expectBookingSummary(page);

  await page.getByRole('textbox', { name: /^name$/i }).fill('');
  await page.getByRole('textbox', { name: /id number/i }).fill('bad-id');
  await page.getByRole('checkbox', { name: /terms of service/i }).check();
  await page.getByRole('button', { name: /place order/i }).click();

  await expect(page.getByText(/required|invalid|please enter|missing/i)).toBeVisible();
  await expect(page.getByText(/please confirm the following information/i)).not.toBeVisible();
});

test('REQ-3.2: reject multiple invalid passenger combinations before confirmation', async ({
  page,
}) => {
  const account = uniqueTicketBookingAccount();
  const criteria = {
    from: 'Shanghai',
    to: 'Beijing',
    date: 'Sun, May 31',
  };
  const cases = [
    {
      passenger: { name: 'A', idNumber: 'C612345677', nationality: 'Vietnam' },
      expected: /at least 2|required|invalid|please provide/i,
      acceptTerms: true,
    },
    {
      passenger: { name: 'Nguyen Duc Minh', idNumber: '12345', nationality: 'Vietnam' },
      expected: /at least 6|required|invalid|please provide/i,
      acceptTerms: true,
    },
    {
      passenger: { name: 'Nguyen Duc Minh', idNumber: 'C612345677', nationality: '' },
      expected: /nationality|required|missing|invalid|please provide/i,
      acceptTerms: true,
    },
    {
      passenger: { name: 'Nguyen Duc Minh', idNumber: 'C612345677', nationality: 'Vietnam' },
      expected: /terms|required|agree|missing|invalid/i,
      acceptTerms: false,
    },
  ];

  await registerAccount(page, account);
  await expectSignedIn(page, account.username);

  for (const currentCase of cases) {
    await openBookingPage(page, criteria);
    await fillBookingForm(page, 'standing ticket', currentCase.passenger, {
      acceptTerms: currentCase.acceptTerms,
    });
    await page.getByRole('button', { name: /place order/i }).click();

    await expect(page.getByText(currentCase.expected)).toBeVisible();
    await expect(page.getByText(/please confirm the following information/i)).not.toBeVisible();
  }
});

test('REQ-3.2: reject passenger name or ID values that are too short', async ({
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

  await page.getByRole('combobox', { name: /ticket class/i }).selectOption({ label: 'standing ticket' });
  await page.getByRole('combobox', { name: /ticket type/i }).selectOption({ label: 'Adult' });
  await page.getByRole('textbox', { name: /^name$/i }).fill('A');
  await page.getByRole('textbox', { name: /id number/i }).fill('12345');
  await page.getByRole('textbox', { name: /nationality/i }).fill('Vietnam');
  await page.getByRole('checkbox', { name: /terms of service/i }).check();
  await page.getByRole('button', { name: /place order/i }).click();

  await expect(page.getByText(/at least 2|at least 6|required|invalid|please provide/i)).toBeVisible();
  await expect(page.getByText(/please confirm the following information/i)).not.toBeVisible();
});

test('REQ-3.2: create a booking with another supported seat type', async ({ page }) => {
  const account = uniqueTicketBookingAccount();
  const criteria = {
    from: 'Shanghai',
    to: 'Beijing',
    date: 'Sun, May 31',
  };
  const passenger = {
    name: 'Chen Li',
    idNumber: 'D712345678',
    nationality: 'Vietnam',
  };

  await registerAccount(page, account);
  await expectSignedIn(page, account.username);
  await searchTrains(page, criteria);
  await openFirstBookableTrain(page);
  await expectBookingSummary(page);

  await page.getByRole('combobox', { name: /ticket class/i }).selectOption({ label: 'Business Class' });
  await page.getByRole('combobox', { name: /ticket type/i }).selectOption({ label: 'Adult' });
  await page.getByRole('textbox', { name: /^name$/i }).fill(passenger.name);
  await page.getByRole('textbox', { name: /id number/i }).fill(passenger.idNumber);
  await page.getByRole('textbox', { name: /nationality/i }).fill(passenger.nationality);
  await page.getByRole('checkbox', { name: /terms of service/i }).check();
  await page.getByRole('button', { name: /place order/i }).click();
  await expect(page.getByText(/please confirm the following information/i)).toBeVisible();
  await page.getByRole('button', { name: /confirm/i }).click();

  await expect(page.getByText(/booking number|order number|success|confirmed/i)).toBeVisible();
  await expect(page.getByText(/Business Class/i)).toBeVisible();
  await expect(page.getByText(passenger.name, { exact: false })).toBeVisible();
});
