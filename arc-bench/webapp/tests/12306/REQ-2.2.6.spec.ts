import { test, expect } from '@playwright/test';
import { navigateToLoginPage } from './helpers';

test('REQ-2.2.6: Submit the login form with an incorrect password', async ({ page }) => {
  // GIVEN: The user is on the login page with an existing username and an incorrect password.
  await navigateToLoginPage(page);
  await page.getByPlaceholder(/Email\/Username\/Mobile number/i).fill('testuser');
  await page.getByPlaceholder(/^Password$/i).fill('WrongPassword1!');

  // WHEN: Click the "LOGIN" button.
  await page.getByRole('button', { name: /LOGIN/i }).click();

  // THEN: The page shows "Incorrect password." and does not complete login.
  await expect(page.getByText(/Incorrect password/i)).toBeVisible();
});
