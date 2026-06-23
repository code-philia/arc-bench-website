import { test, expect } from '@playwright/test';
import { navigateToForgotPasswordPage } from './helpers';

test.beforeEach(async ({ request }) => {
  // Reset testuser email in case prior tests changed it
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

test('REQ-2.4.2: Display the forgot password forms', async ({ page }) => {
  // GIVEN: The user is on the forgot password page.
  await navigateToForgotPasswordPage(page);

  // WHEN: Observe the first step.
  // THEN: The first step shows the "Email: " field, the "ID number: " field, and the "submit" button.
  await expect(page.getByLabel(/Email/i)).toBeVisible();
  await expect(page.getByLabel(/ID number/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();

  // Fill identity fields with valid matching data to proceed to step 2
  await page.getByLabel(/Email/i).fill('testuser@example.com');
  await page.getByLabel(/ID number/i).fill('1234567890');
  await page.getByRole('button', { name: /submit/i }).click();

  // THEN: The second step shows the "New password: " field, the "Confirm new password: " field, and the "submit" button.
  await expect(page.getByLabel(/^New password$/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel(/Confirm new password/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();
});
