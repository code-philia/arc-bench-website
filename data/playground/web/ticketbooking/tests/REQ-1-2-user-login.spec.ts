import { expect, test } from '@playwright/test';
import {
  expectSignedIn,
  registerAccount,
  signIn,
  signOut,
  uniqueTicketBookingAccount,
} from './support/e2e';

test('REQ-1.2: sign in with a valid username and password', async ({ page }) => {
  const account = uniqueTicketBookingAccount();

  await registerAccount(page, account);
  await signOut(page);

  await signIn(page, account.username, account.password);
  await expectSignedIn(page, account.username);
  await page.reload();
  await expectSignedIn(page, account.username);
});

test('REQ-1.2: sign in with a valid email and password', async ({ page }) => {
  const account = uniqueTicketBookingAccount();

  await registerAccount(page, account);
  await signOut(page);

  await signIn(page, account.email, account.password);
  await expectSignedIn(page, account.username);
});

test('REQ-1.2: reject wrong password or incomplete credentials', async ({ page }) => {
  const account = uniqueTicketBookingAccount();

  await registerAccount(page, account);
  await signOut(page);

  await signIn(page, account.username, 'incorrect-password');
  await expect(page.getByText(/invalid|failed|incorrect|wrong/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /sign out/i })).not.toBeVisible();
});

test('REQ-1.2: reject an unknown account and stay logged out', async ({ page }) => {
  const account = uniqueTicketBookingAccount();
  const unknownAccount = `unknown-${Date.now()}@example.test`;

  await registerAccount(page, account);
  await signOut(page);

  await signIn(page, unknownAccount, account.password);
  await expect(page.getByText(/not found|invalid|failed|incorrect|wrong/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /sign out/i })).not.toBeVisible();
});

test('REQ-1.2: trim whitespace around the account identifier when signing in', async ({
  page,
}) => {
  const account = uniqueTicketBookingAccount();

  await registerAccount(page, account);
  await signOut(page);

  await signIn(page, `  ${account.email}  `, account.password);
  await expectSignedIn(page, account.username);
  await page.reload();
  await expectSignedIn(page, account.username);
});

test('REQ-1.2: trim whitespace around both username and email identifiers', async ({ page }) => {
  const account = uniqueTicketBookingAccount();

  await registerAccount(page, account);
  await signOut(page);

  for (const identifier of [account.username, account.email]) {
    await signIn(page, `  ${identifier}  `, account.password);
    await expectSignedIn(page, account.username);
    await signOut(page);
  }
});
