import { test, expect } from '@playwright/test';
import { navigateToRegistrationPage } from './helpers';

test('REQ-2.1.2: Display the registration form layout', async ({ page }) => {
  // GIVEN: The user is on the registration page.
  await navigateToRegistrationPage(page);

  // WHEN: Observe the form content.
  // THEN: The page shows all labeled fields, agreement checkbox text, and the "Register" button.
  await expect(page.getByLabel(/Nationality/i)).toBeVisible();
  await expect(page.getByLabel(/^Name$/i)).toBeVisible();
  await expect(page.getByLabel(/Passport number/i)).toBeVisible();
  await expect(page.getByLabel(/Passport expiration date/i)).toBeVisible();
  await expect(page.getByLabel(/Date of birth/i)).toBeVisible();
  await expect(page.getByLabel(/^Male$/i)).toBeVisible();
  await expect(page.getByLabel(/^Female$/i)).toBeVisible();
  await expect(page.getByLabel(/Username/i)).toBeVisible();
  await expect(page.getByLabel(/^Password$/i)).toBeVisible();
  await expect(page.getByLabel(/Confirm Password/i)).toBeVisible();
  await expect(page.getByLabel(/Email address/i)).toBeVisible();

  // Agreement checkbox and text
  await expect(page.getByRole('checkbox', { name: /Terms of Service.*Privacy Policy/i })).toBeVisible();

  // Register button
  await expect(page.getByRole('button', { name: /Register/i })).toBeVisible();
});
