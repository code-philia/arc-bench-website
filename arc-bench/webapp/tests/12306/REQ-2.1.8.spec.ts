import { test, expect } from '@playwright/test';
import { navigateToRegistrationPage, fillRegistrationForm } from './helpers';

test('REQ-2.1.8: Submit the form with an invalid email address', async ({ page }) => {
  // GIVEN: The user is on the registration page with an invalid value in the Email address field.
  await navigateToRegistrationPage(page);
  const timestamp = Date.now();
  await fillRegistrationForm(page, {
    nationality: 'China',
    name: 'Test User',
    passportNumber: `E${timestamp}`,
    passportExpirationDate: '2030-12-31',
    dateOfBirth: '1990-01-01',
    gender: 'Male',
    username: `testuser_${timestamp}`,
    password: 'Test1234!',
    confirmPassword: 'Test1234!',
    emailAddress: 'invalid-email', // Invalid email format
  });
  await page.getByRole('checkbox', { name: /Terms of Service.*Privacy Policy/i }).check();

  // WHEN: Click the "Register" button.
  await page.getByRole('button', { name: /Register/i }).click();

  // THEN: The page shows "Invalid email address format." and does not complete registration.
  await expect(page.getByText(/Invalid email address format/i)).toBeVisible();
});
