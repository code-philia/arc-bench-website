import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  expectSignedIn,
  openRegister,
  registerAccount,
  signOut,
  uniqueTicketBookingAccount,
} from './support/e2e';
import type { TicketBookingAccount } from './support/e2e';

type RegistrationOverrides = {
  confirmPassword?: string;
  email?: string;
  omitPassportNumber?: boolean;
  omitTerms?: boolean;
  password?: string;
  username?: string;
};

async function fillRegistrationForm(
  page: Page,
  account: TicketBookingAccount,
  overrides: RegistrationOverrides = {},
): Promise<void> {
  await openRegister(page);
  await page.getByLabel(/nationality/i).selectOption({ label: account.nationality });
  await page.getByLabel(/^name$/i).fill(account.name);
  if (!overrides.omitPassportNumber) {
    await page.getByLabel(/passport number/i).fill(account.passportNumber);
  }
  await page.getByLabel(/passport expiration date/i).fill(account.passportExpirationDate);
  await page.getByLabel(/date of birth/i).fill(account.dateOfBirth);
  await page.getByLabel(new RegExp(`^${account.gender}$`, 'i')).check();
  await page.getByLabel(/^username$/i).fill(overrides.username ?? account.username);
  await page.getByLabel(/^password$/i).fill(overrides.password ?? account.password);
  await page
    .getByLabel(/confirm password/i)
    .fill(overrides.confirmPassword ?? overrides.password ?? account.password);
  await page.getByLabel(/email address/i).fill(overrides.email ?? account.email);
  if (!overrides.omitTerms) {
    await page.getByRole('checkbox', { name: /terms of service|privacy policy|agree/i }).check();
  }
}

test('REQ-1.1: successfully register a new account and remain signed in', async ({ page }) => {
  const account = uniqueTicketBookingAccount();

  await registerAccount(page, account);
  await expectSignedIn(page, account.username);

  await page.reload();
  await expectSignedIn(page, account.username);
});

test('REQ-1.1: reject duplicate account data without creating a signed-in session', async ({ page }) => {
  const account = uniqueTicketBookingAccount();

  await registerAccount(page, account);
  await expectSignedIn(page, account.username);
  await signOut(page);

  await openRegister(page);
  await page.getByLabel(/nationality/i).selectOption({ label: account.nationality });
  await page.getByLabel(/^name$/i).fill(`Duplicate ${account.name}`);
  await page.getByLabel(/passport number/i).fill(`${account.passportNumber}1`);
  await page.getByLabel(/passport expiration date/i).fill(account.passportExpirationDate);
  await page.getByLabel(/date of birth/i).fill(account.dateOfBirth);
  await page.getByLabel(new RegExp(`^${account.gender}$`, 'i')).check();
  await page.getByLabel(/^username$/i).fill(account.username);
  await page.getByLabel(/^password$/i).fill(account.password);
  await page.getByLabel(/confirm password/i).fill(account.password);
  await page.getByLabel(/email address/i).fill(account.email);
  await page.getByRole('checkbox', { name: /terms of service|privacy policy|agree/i }).check();
  await page.getByRole('button', { name: /next step/i }).click();

  await expect(page.getByText(/already exists|duplicate|taken|conflict/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /sign out/i })).not.toBeVisible();
});

test('REQ-1.1: reject duplicate email with a different username', async ({ page }) => {
  const account = uniqueTicketBookingAccount();

  await registerAccount(page, account);
  await expectSignedIn(page, account.username);
  await signOut(page);

  await openRegister(page);
  await page.getByLabel(/nationality/i).selectOption({ label: account.nationality });
  await page.getByLabel(/^name$/i).fill(`Another ${account.name}`);
  await page.getByLabel(/passport number/i).fill(`${account.passportNumber}9`);
  await page.getByLabel(/passport expiration date/i).fill(account.passportExpirationDate);
  await page.getByLabel(/date of birth/i).fill(account.dateOfBirth);
  await page.getByLabel(new RegExp(`^${account.gender}$`, 'i')).check();
  await page.getByLabel(/^username$/i).fill(`${account.username}-alt`);
  await page.getByLabel(/^password$/i).fill(account.password);
  await page.getByLabel(/confirm password/i).fill(account.password);
  await page.getByLabel(/email address/i).fill(account.email);
  await page.getByRole('checkbox', { name: /terms of service|privacy policy|agree/i }).check();
  await page.getByRole('button', { name: /next step/i }).click();

  await expect(page.getByText(/already exists|duplicate|taken|conflict|email/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /sign out/i })).not.toBeVisible();
});

test('REQ-1.1: reject invalid input such as mismatched passwords or missing required fields', async ({
  page,
}) => {
  const account = uniqueTicketBookingAccount();

  await openRegister(page);
  await page.getByLabel(/nationality/i).selectOption({ label: account.nationality });
  await page.getByLabel(/^name$/i).fill(account.name);
  await page.getByLabel(/passport number/i).fill(account.passportNumber);
  await page.getByLabel(/passport expiration date/i).fill(account.passportExpirationDate);
  await page.getByLabel(/date of birth/i).fill(account.dateOfBirth);
  await page.getByLabel(new RegExp(`^${account.gender}$`, 'i')).check();
  await page.getByLabel(/^username$/i).fill(account.username);
  await page.getByLabel(/^password$/i).fill(account.password);
  await page.getByLabel(/confirm password/i).fill(`${account.password}-mismatch`);
  await page.getByLabel(/email address/i).fill(account.email);
  await page.getByRole('checkbox', { name: /terms of service|privacy policy|agree/i }).check();
  await page.getByRole('button', { name: /next step/i }).click();

  await expect(page.getByText(/match|mismatch|invalid|required|confirm/i)).toBeVisible();
});

test('REQ-1.1: reject more invalid registration combinations before creating a session', async ({
  page,
}) => {
  const cases: Array<{
    expected: RegExp;
    overrides: RegistrationOverrides;
  }> = [
    {
      expected: /terms|agree|required|missing/i,
      overrides: { omitTerms: true },
    },
    {
      expected: /passport|required|missing|invalid/i,
      overrides: { omitPassportNumber: true },
    },
    {
      expected: /match|mismatch|invalid|required|confirm/i,
      overrides: { confirmPassword: 'mismatch-password' },
    },
  ];

  for (const currentCase of cases) {
    const account = uniqueTicketBookingAccount();
    await fillRegistrationForm(page, account, currentCase.overrides);
    await page.getByRole('button', { name: /next step/i }).click();

    await expect(page.getByText(currentCase.expected)).toBeVisible();
    await expect(page.getByRole('link', { name: /sign out/i })).not.toBeVisible();
  }
});

test('REQ-1.1: reject malformed username, email, or password without signing in', async ({ page }) => {
  const cases: Array<{ expected: RegExp; overrides: RegistrationOverrides }> = [
    {
      expected: /username|required|invalid|format/i,
      overrides: { username: 'bad username!' },
    },
    {
      expected: /email|required|invalid|format/i,
      overrides: { email: 'not-an-email' },
    },
    {
      expected: /password|required|invalid|at least|weak/i,
      overrides: { password: 'short' },
    },
  ];

  for (const currentCase of cases) {
    const account = uniqueTicketBookingAccount();
    await fillRegistrationForm(page, account, currentCase.overrides);
    await page.getByRole('button', { name: /next step/i }).click();

    await expect(page.getByText(currentCase.expected)).toBeVisible();
    await expect(page.getByRole('link', { name: /sign out/i })).not.toBeVisible();
  }
});
