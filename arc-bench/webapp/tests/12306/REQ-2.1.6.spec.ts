import { test, expect } from '@playwright/test';
import { navigateToRegistrationPage, fillValidRegistrationForm } from './helpers';

test('REQ-2.1.6: Submit the form with an existing username', async ({ page }) => {
  // GIVEN: The user is on the registration page with a username that already exists in the system.
  await navigateToRegistrationPage(page);
  // Use the pre-existing username from prerequisites
  await fillValidRegistrationForm(page, { username: 'testuser' });

  // WHEN: Click the "Register" button.
  await page.getByRole('button', { name: /Register/i }).click();

  // THEN: The page shows "Username already exists." and does not complete registration.
  await expect(page.getByText(/Username already exists/i)).toBeVisible();
});
