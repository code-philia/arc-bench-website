import { test, expect } from '@playwright/test';
import { navigateToLoginPage } from './helpers';

test('REQ-2.2.4: Submit the login form with missing account information or password', async ({ page }) => {
  // GIVEN: The user is on the login page with the account field empty, the password field empty, or both.
  await navigateToLoginPage(page);
  // Leave both fields empty

  // WHEN: Click the "LOGIN" button.
  await page.getByRole('button', { name: /LOGIN/i }).click();

  // THEN: The page shows "Please enter your username/email/phone number and password." and does not complete login.
  await expect(page.getByText(/Please enter your username\/email\/phone number and password/i)).toBeVisible();
});

test('REQ-2.2.4: Submit the login form with missing password only', async ({ page }) => {
  // GIVEN: The user is on the login page with only the account filled.
  await navigateToLoginPage(page);
  await page.getByPlaceholder(/Email\/Username\/Mobile number/i).fill('testuser');

  // WHEN: Click the "LOGIN" button.
  await page.getByRole('button', { name: /LOGIN/i }).click();

  // THEN: The page shows "Please enter your username/email/phone number and password."
  await expect(page.getByText(/Please enter your username\/email\/phone number and password/i)).toBeVisible();
});

test('REQ-2.2.4: Submit the login form with missing account only', async ({ page }) => {
  // GIVEN: The user is on the login page with only the password filled.
  await navigateToLoginPage(page);
  await page.getByPlaceholder(/^Password$/i).fill('Test1234!');

  // WHEN: Click the "LOGIN" button.
  await page.getByRole('button', { name: /LOGIN/i }).click();

  // THEN: The page shows "Please enter your username/email/phone number and password."
  await expect(page.getByText(/Please enter your username\/email\/phone number and password/i)).toBeVisible();
});
