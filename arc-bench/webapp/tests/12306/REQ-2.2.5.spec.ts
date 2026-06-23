import { test, expect } from '@playwright/test';
import { navigateToLoginPage } from './helpers';

test('REQ-2.2.5: Submit the login form with an unknown account', async ({ page }) => {
  // GIVEN: The user is on the login page with a username that does not exist and a password entered.
  await navigateToLoginPage(page);
  await page.getByPlaceholder(/Email\/Username\/Mobile number/i).fill('nonexistent_user_12345');
  await page.getByPlaceholder(/^Password$/i).fill('SomePassword1!');

  // WHEN: Click the "LOGIN" button.
  await page.getByRole('button', { name: /LOGIN/i }).click();

  // THEN: The page shows "User not found." and does not complete login.
  await expect(page.getByText(/User not found/i)).toBeVisible();
});
