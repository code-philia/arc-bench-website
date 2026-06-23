import { test, expect } from '@playwright/test';
import { navigateToRegistrationPage } from './helpers';

test('REQ-2.5.2: Open the privacy policy page from the registration page', async ({ page }) => {
  // GIVEN: The user is on the registration page.
  await navigateToRegistrationPage(page);

  // WHEN: Click the "Privacy Policy" link in the agreement text.
  await page.getByRole('link', { name: /Privacy Policy/i }).click();

  // THEN: Navigate to the privacy policy page and show the title "Privacy Policy".
  await expect(page.getByRole('heading', { name: /Privacy Policy/i })).toBeVisible({ timeout: 10000 });
});
