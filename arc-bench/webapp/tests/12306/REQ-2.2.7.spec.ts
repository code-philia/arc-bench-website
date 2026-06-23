import { test, expect } from '@playwright/test';
import { navigateToLoginPage } from './helpers';

test('REQ-2.2.7: Open the registration page from the login page', async ({ page }) => {
  // GIVEN: The user is on the login page.
  await navigateToLoginPage(page);

  // WHEN: Click the link "No account yet? Register now."
  await page.getByRole('link', { name: /No account yet\? Register now/i }).click();

  // THEN: Navigate to the registration page.
  await expect(page).toHaveURL(/register/i);
});
