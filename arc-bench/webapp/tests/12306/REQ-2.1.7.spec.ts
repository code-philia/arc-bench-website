import { test, expect } from '@playwright/test';
import { navigateToRegistrationPage, fillRegistrationForm } from './helpers';

test('REQ-2.1.7: Submit the form with mismatched passwords', async ({ page }) => {
  // GIVEN: The user is on the registration page with different values in Password and Confirm Password.
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
    confirmPassword: 'DifferentPassword!',
    emailAddress: `test_${timestamp}@example.com`,
  });
  await page.getByRole('checkbox', { name: /Terms of Service.*Privacy Policy/i }).check();

  // WHEN: Click the "Register" button.
  await page.getByRole('button', { name: /Register/i }).click();

  // THEN: The page shows "Passwords do not match." and does not complete registration.
  await expect(page.getByText(/Passwords do not match/i)).toBeVisible();
});
