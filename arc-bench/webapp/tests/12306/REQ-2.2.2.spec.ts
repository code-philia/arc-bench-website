import { test, expect } from '@playwright/test';
import { navigateToLoginPage } from './helpers';

test('REQ-2.2.2: Display the login form layout', async ({ page }) => {
  // GIVEN: The user is on the login page.
  await navigateToLoginPage(page);

  // WHEN: Observe the page.
  // THEN: The page shows the account input, password input, and LOGIN button.
  await expect(page.getByPlaceholder(/Email\/Username\/Mobile number/i)).toBeVisible();
  await expect(page.getByPlaceholder(/^Password$/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /LOGIN/i })).toBeVisible();
});
