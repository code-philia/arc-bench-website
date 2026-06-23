import { test, expect } from '@playwright/test';
import { navigateToRegistrationPage } from './helpers';

test('REQ-2.5.1: Open the terms of service page from the registration page', async ({ page }) => {
  // GIVEN: The user is on the registration page.
  await navigateToRegistrationPage(page);

  // WHEN: Click the "Terms of Service" link in the agreement text.
  await page.getByRole('link', { name: /Terms of Service/i }).click();

  // THEN: Navigate to the terms page and show the title "Terms of Service".
  await expect(page.getByRole('heading', { name: /Terms of Service/i })).toBeVisible({ timeout: 10000 });
});
