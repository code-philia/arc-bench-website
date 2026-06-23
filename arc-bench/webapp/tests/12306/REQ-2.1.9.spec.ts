import { test, expect } from '@playwright/test';
import { navigateToRegistrationPage, fillRegistrationForm } from './helpers';

test('REQ-2.1.9: Submit the form without accepting the agreement', async ({ page }) => {
  // GIVEN: The user is on the registration page with all required fields valid and the agreement checkbox not selected.
  await navigateToRegistrationPage(page);
  // Fill valid form but do NOT check the agreement checkbox
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
    emailAddress: `test_${timestamp}@example.com`,
  });
  // Explicitly ensure the agreement checkbox is NOT checked
  const checkbox = page.getByRole('checkbox', { name: /Terms of Service.*Privacy Policy/i });
  if (await checkbox.isChecked()) {
    await checkbox.uncheck();
  }

  // WHEN: Click the "Register" button.
  await page.getByRole('button', { name: /Register/i }).click();

  // THEN: The page shows "Please agree to the Terms of Service and Privacy Policy." and does not complete registration.
  await expect(page.getByText(/Please agree to the Terms of Service and Privacy Policy/i)).toBeVisible();
});
