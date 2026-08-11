import { expect, test } from '@playwright/test';
import {
  expectBookingSummary,
  expectSignedIn,
  openFirstBookableTrain,
  registerAccount,
  searchTrains,
  uniqueTicketBookingAccount,
  signOut,
} from './support/e2e';

test('REQ-3.3: show the booking success result with record details', async ({ page }) => {
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
  await page.getByRole('button', { name: /confirm/i }).click();

  await expect(page.getByText(/booking number|order number/i)).toBeVisible();
  await expect(page.getByText(/train summary|train information/i)).toBeVisible();
  await expect(page.getByText(/passenger summary|passenger information/i)).toBeVisible();
  await expect(page.getByText(/success|confirmed|booked/i)).toBeVisible();
  await expect(page.getByText(passenger.name, { exact: false })).toBeVisible();
});

test('REQ-3.3: keep the booking success record visible after reloading the page', async ({
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
  await page.getByRole('button', { name: /confirm/i }).click();

  const successUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(successUrl);
  await expect(page.getByText(/booking number|order number/i)).toBeVisible();
  await expect(page.getByText(/train summary|train information/i)).toBeVisible();
  await expect(page.getByText(/passenger summary|passenger information/i)).toBeVisible();
  await expect(page.getByText(/success|confirmed|booked/i)).toBeVisible();
  await expect(page.getByText(passenger.name, { exact: false })).toBeVisible();
});

test('REQ-3.3: show and keep the booking success result for another supported booking combination', async ({
  page,
}) => {
  const account = uniqueTicketBookingAccount();
  const criteria = {
    from: 'Beijing',
    to: 'Tianjin',
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
  await page.getByRole('button', { name: /confirm/i }).click();

  const successUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(successUrl);
  await expect(page.getByText(/booking number|order number/i)).toBeVisible();
  await expect(page.getByText(/train summary|train information/i)).toBeVisible();
  await expect(page.getByText(/passenger summary|passenger information/i)).toBeVisible();
  await expect(page.getByText(/success|confirmed|booked/i)).toBeVisible();
  await expect(page.getByText(passenger.name, { exact: false })).toBeVisible();
  await expect(page.getByText(/business class/i)).toBeVisible();
});

test('REQ-3.3: another signed-in traveler cannot read the booking owner’s success record', async ({ page }) => {
  const owner = uniqueTicketBookingAccount();
  const otherTraveler = uniqueTicketBookingAccount();
  const criteria = { from: 'Shanghai', to: 'Beijing', date: 'Sun, May 31' };

  await registerAccount(page, owner);
  await searchTrains(page, criteria);
  await openFirstBookableTrain(page);
  await expectBookingSummary(page);
  await page.getByRole('combobox', { name: /ticket class/i }).selectOption({ label: 'standing ticket' });
  await page.getByRole('combobox', { name: /ticket type/i }).selectOption({ label: 'Adult' });
  await page.getByRole('textbox', { name: /^name$/i }).fill(owner.name);
  await page.getByRole('textbox', { name: /id number/i }).fill('C612345677');
  await page.getByRole('textbox', { name: /nationality/i }).fill(owner.nationality);
  await page.getByRole('checkbox', { name: /terms of service/i }).check();
  await page.getByRole('button', { name: /place order/i }).click();
  await page.getByRole('button', { name: /confirm/i }).click();
  const ownerSuccessUrl = page.url();

  await signOut(page);
  await registerAccount(page, otherTraveler);
  await expectSignedIn(page, otherTraveler.username);
  await page.goto(ownerSuccessUrl);

  await expect(page.getByText(/not found|no access|unauthorized|forbidden|sign in/i)).toBeVisible();
  await expect(page.getByText(owner.name, { exact: false })).toHaveCount(0);
});
