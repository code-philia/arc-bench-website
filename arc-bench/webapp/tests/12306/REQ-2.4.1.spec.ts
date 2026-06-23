import { test, expect } from '@playwright/test';
import { navigateToForgotPasswordPage } from './helpers';

test('REQ-2.4.1: Open the forgot password page from the login page', async ({ page }) => {
  // GIVEN: The user is on the login page.
  // WHEN: Click the link "Forgot password?".
  await navigateToForgotPasswordPage(page);

  // THEN: Navigate to the forgot password page.
  await expect(page).toHaveURL(/forgot.*password|reset.*password/i);
});
