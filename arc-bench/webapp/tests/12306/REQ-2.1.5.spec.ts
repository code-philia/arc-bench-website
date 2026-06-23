import { test, expect } from '@playwright/test';
import { navigateToRegistrationPage, fillValidRegistrationForm } from './helpers';

test('REQ-2.1.5: Submit the form with an existing passport number', async ({ page }) => {
  // GIVEN: The user is on the registration page with a passport number that already exists in the system.
  await navigateToRegistrationPage(page);
  // Use the pre-existing passport number from prerequisites
  await fillValidRegistrationForm(page, { passportNumber: 'E12345678' });

  // WHEN: Click the "Register" button.
  await page.getByRole('button', { name: /Register/i }).click();

  // THEN: The page shows "Passport number already exists." and does not complete registration.
  await expect(page.getByText(/Passport number already exists/i)).toBeVisible();
});
