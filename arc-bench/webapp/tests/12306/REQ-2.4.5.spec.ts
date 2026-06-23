import { test, expect } from '@playwright/test';
import { navigateToForgotPasswordPage } from './helpers';

test('REQ-2.4.5: Submit the identity verification step with unmatched records', async ({ page }) => {
  // GIVEN: The user is on the first step with an email and ID number that do not match the registration record.
  await navigateToForgotPasswordPage(page);
  await page.getByLabel(/Email/i).fill('testuser@example.com');
  await page.getByLabel(/ID number/i).fill('9999999999'); // Non-matching ID number

  // WHEN: Click the "submit" button.
  await page.getByRole('button', { name: /submit/i }).click();

  // THEN: The page shows "Email and ID number do not match our records." and does not continue.
  await expect(page.getByText(/Email and ID number do not match our records/i)).toBeVisible();
});
