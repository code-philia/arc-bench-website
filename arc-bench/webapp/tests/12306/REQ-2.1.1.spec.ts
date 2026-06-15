import { test, expect } from '@playwright/test';
import { navigateToRegistrationPage } from './helpers';

test('REQ-2.1.1: Open the registration page from the home page', async ({ page }) => {
  // GIVEN: The user is on the home page and is not logged in.
  // WHEN: Click the "Register" link in the top-right area.
  await navigateToRegistrationPage(page);

  // THEN: Navigate to the registration page.
  await expect(page).toHaveURL(/register/i);
});
