import { test, expect } from '@playwright/test';
import { navigateToForgotPasswordPage } from './helpers';

test.beforeEach(async ({ request }) => {
  const loginResp = await request.post('http://localhost:3000/api/auth/login', {
    data: { account: 'testuser', password: 'Test1234!' },
  });
  const loginData = await loginResp.json();
  if (loginData.token) {
    await request.patch('http://localhost:3000/api/profile/user-information/contact', {
      headers: { Authorization: `Bearer ${loginData.token}` },
      data: { email: 'testuser@example.com' },
    }).catch(() => {});
  }
});

test('REQ-2.4.6: Submit the new password step with mismatched passwords', async ({ page }) => {
  // GIVEN: The user is on the new password step with different values in New password and Confirm new password.
  await navigateToForgotPasswordPage(page);

  // Step 1: Complete identity verification with matching data
  await page.getByLabel(/Email/i).fill('testuser@example.com');
  await page.getByLabel(/ID number/i).fill('1234567890');
  await page.getByRole('button', { name: /submit/i }).click();

  // Step 2: Fill mismatched new passwords
  await expect(page.getByLabel(/^New password$/i)).toBeVisible({ timeout: 10000 });
  await page.getByLabel(/^New password$/i).fill('NewPassword1!');
  await page.getByLabel(/Confirm new password/i).fill('DifferentPassword1!');

  // WHEN: Click the "submit" button.
  await page.getByRole('button', { name: /submit/i }).click();

  // THEN: The page shows "Passwords do not match." and does not reset the password.
  await expect(page.getByText(/Passwords do not match/i)).toBeVisible();
});
