import { test, expect } from '@playwright/test';
import { navigateToRegistrationPage, fillValidRegistrationForm } from './helpers';

test('REQ-2.1.3: Submit a valid registration form', async ({ page }) => {
  // GIVEN: The user is on the registration page with all required fields filled with valid values.
  await navigateToRegistrationPage(page);
  await fillValidRegistrationForm(page);

  // WHEN: Click the "Register" button.
  await page.getByRole('button', { name: /Register/i }).click();

  // THEN: The system persists the user information and shows a successful registration message.
  await expect(page.getByText(/success|registered|Registration successful/i)).toBeVisible({ timeout: 10000 });
});
