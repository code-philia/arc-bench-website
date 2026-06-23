import { test, expect } from '@playwright/test';
import { navigateToRegistrationPage, fillValidRegistrationForm } from './helpers';

test('REQ-2.1.4: Submit the form with missing required information', async ({ page }) => {
  // GIVEN: The user is on the registration page with one or more required fields left empty.
  await navigateToRegistrationPage(page);
  // Fill valid data but leave the Name field empty
  const timestamp = Date.now();
  await fillValidRegistrationForm(page, { username: `testuser_${timestamp}` });
  // Clear the Name field to make it empty
  await page.getByLabel(/^Name$/i).clear();

  // WHEN: Click the "Register" button.
  await page.getByRole('button', { name: /Register/i }).click();

  // THEN: The page shows "Please fill in all required fields." and does not complete registration.
  await expect(page.getByText(/Please fill in all required fields/i)).toBeVisible();
});
