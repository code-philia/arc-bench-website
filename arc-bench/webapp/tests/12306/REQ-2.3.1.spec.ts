import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers';

test('REQ-2.3.1: Sign out from the home page', async ({ page }) => {
  // GIVEN: The user is logged in and is on the home page.
  await loginAsTestUser(page);

  // Verify "Sign Out" link is visible (replaces "Register")
  await expect(page.getByRole('link', { name: /Sign Out/i })).toBeVisible();

  // WHEN: Click the "Sign Out" link in the top-right area.
  await page.getByRole('link', { name: /Sign Out/i }).click();

  // THEN: The system clears the login state, shows a successful logout message,
  // changes the top-right link from "Sign Out" to "Register", and shows "Login" instead of the user name.
  await expect(page.getByText(/success|logged out|Logout successful/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('link', { name: /Register/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Login/i })).toBeVisible();
});
