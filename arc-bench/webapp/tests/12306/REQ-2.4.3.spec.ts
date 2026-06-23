import { test, expect } from '@playwright/test';
import { navigateToForgotPasswordPage, restoreTestUserPassword } from './helpers';

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

test('REQ-2.4.3: Complete a valid password reset', async ({ page }) => {
  // GIVEN: The user is on the forgot password flow with matching email and ID number, and matching new passwords.
  await navigateToForgotPasswordPage(page);

  // Step 1: Fill identity verification
  await page.getByLabel(/Email/i).fill('testuser@example.com');
  await page.getByLabel(/ID number/i).fill('1234567890');
  await page.getByRole('button', { name: /submit/i }).click();

  // Step 2: Fill new passwords
  await expect(page.getByLabel(/^New password$/i)).toBeVisible({ timeout: 10000 });
  await page.getByLabel(/^New password$/i).fill('NewPassword1!');
  await page.getByLabel(/Confirm new password/i).fill('NewPassword1!');

  // WHEN: Click the "submit" button in the final step.
  await page.getByRole('button', { name: /submit/i }).click();

  // THEN: The system persists the new password and shows a successful password reset message.
  await expect(page.getByText(/success|reset successful|Password reset successful/i)).toBeVisible({ timeout: 10000 });

  // RESTORE: Reset the password back so subsequent tests are not affected.
  await restoreTestUserPassword(page, 'NewPassword1!');
});
