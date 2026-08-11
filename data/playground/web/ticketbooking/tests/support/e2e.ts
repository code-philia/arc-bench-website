import { expect, Page, TestInfo } from '@playwright/test';

export type TicketBookingAccount = {
  username: string;
  email: string;
  password: string;
  name: string;
  nationality: string;
  passportNumber: string;
  passportExpirationDate: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female';
};

export type SearchCriteria = {
  from: string;
  to: string;
  date: string;
};

export function baseUrl(): string {
  return process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
}

export function requiredEnv(testInfo: TestInfo, name: string): string {
  const value = process.env[name];
  testInfo.skip(!value, `Set ${name} to run this scenario.`);
  return value!;
}

export function uniqueTicketBookingAccount(): TicketBookingAccount {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const username = `tb-user-${suffix}`;

  return {
    username,
    email: `${username}@example.test`,
    password: 'Valid-password-123!',
    name: `Ticket User ${suffix}`,
    nationality: 'Vietnam',
    passportNumber: `P${suffix.replace(/[^0-9]/g, '').slice(0, 11) || Date.now()}`,
    passportExpirationDate: '2035-12-31',
    dateOfBirth: '1995-06-15',
    gender: 'Male',
  };
}

export async function openHome(page: Page): Promise<void> {
  await page.goto(baseUrl());
}

export async function openRegister(page: Page): Promise<void> {
  await openHome(page);
  await page.getByRole('link', { name: /register/i }).click();
}

export async function openLogin(page: Page): Promise<void> {
  await openHome(page);
  await page.getByRole('link', { name: /login/i }).click();
}

export async function expectSignedIn(page: Page, username: string): Promise<void> {
  await expect(page.getByText(username, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /sign out/i })).toBeVisible();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('link', { name: /sign out/i }).click();
  await expect(page.getByRole('link', { name: /login/i })).toBeVisible();
}

export async function registerAccount(page: Page, account: TicketBookingAccount): Promise<void> {
  await openRegister(page);
  await page.getByLabel(/nationality/i).selectOption({ label: account.nationality });
  await page.getByLabel(/^name$/i).fill(account.name);
  await page.getByLabel(/passport number/i).fill(account.passportNumber);
  await page.getByLabel(/passport expiration date/i).fill(account.passportExpirationDate);
  await page.getByLabel(/date of birth/i).fill(account.dateOfBirth);
  await page.getByLabel(new RegExp(`^${account.gender}$`, 'i')).check();
  await page.getByLabel(/^username$/i).fill(account.username);
  await page.getByLabel(/^password$/i).fill(account.password);
  await page.getByLabel(/confirm password/i).fill(account.password);
  await page.getByLabel(/email address/i).fill(account.email);
  await page.getByRole('checkbox', { name: /terms of service|privacy policy|agree/i }).check();
  await page.getByRole('button', { name: /next step/i }).click();
}

export async function signIn(page: Page, usernameOrEmail: string, password: string): Promise<void> {
  await openLogin(page);
  await page.getByLabel(/username or email|email\/username\/mobile number/i).fill(usernameOrEmail);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /login|sign in/i }).click();
}

export async function searchTrains(page: Page, criteria: SearchCriteria): Promise<void> {
  await openHome(page);
  await page.getByLabel(/^from$/i).fill(criteria.from);
  await page.getByLabel(/^to$/i).fill(criteria.to);
  await page.getByLabel(/^date$/i).fill(criteria.date);
  await page.getByRole('button', { name: /search/i }).click();
}

export async function openFirstBookableTrain(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^book$/i }).first().click();
}

export async function expectSearchSummary(
  page: Page,
  criteria: SearchCriteria,
): Promise<void> {
  await expect(page.getByText(criteria.from, { exact: false })).toBeVisible();
  await expect(page.getByText(criteria.to, { exact: false })).toBeVisible();
  await expect(page.getByText(criteria.date, { exact: false })).toBeVisible();
}

export async function expectBookingSummary(page: Page): Promise<void> {
  await expect(page.getByText(/train information/i)).toBeVisible();
  await expect(page.getByText(/passenger information/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /place order/i })).toBeVisible();
}
