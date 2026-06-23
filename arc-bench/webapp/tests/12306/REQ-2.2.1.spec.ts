import { test, expect } from '@playwright/test';
import { navigateToLoginPage } from './helpers';

test('REQ-2.2.1: Open the login page from the home page', async ({ page }) => {
  // GIVEN: The user is on the home page and is not logged in.
  // WHEN: Click the "Login" link in the top-right area.
  await navigateToLoginPage(page);

  // THEN: Navigate to the login page.
  await expect(page).toHaveURL(/login/i);
});
