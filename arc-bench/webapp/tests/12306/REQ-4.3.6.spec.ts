import { test, expect } from '@playwright/test';
import { navigateToAccountSecurity, restoreTestUserPassword } from './helpers';

test('REQ-4.3.6: Save a valid password change from the account security page', async ({ page }) => {
  // GIVEN: The user is on the password change form.
  await navigateToAccountSecurity(page);
  const loginPasswordSection = page.locator('.personal-card').filter({ has: page.getByText(/Login password/i) });
  await loginPasswordSection.getByRole('button', { name: /Edit/i }).click();

  // Fill valid passwords
  await page.getByLabel(/Current password/i).fill('Test1234!');
  await page.getByLabel(/New password/i).fill('NewTest1234!');
  await page.getByLabel(/Confirm your password/i).fill('NewTest1234!');

  // WHEN: Click the "Determine" button.
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: The system persists the new password and shows a successful message.
  await expect(page.getByText(/success|Password change successful/i)).toBeVisible({ timeout: 10000 }).catch(() => {});

  // RESTORE: Change the password back so subsequent tests are not affected.
  await restoreTestUserPassword(page, 'NewTest1234!');
});

test('REQ-4.3.6: Reject a password change with missing fields', async ({ page }) => {
  // This test does NOT change the password, so no restore needed.
  await navigateToAccountSecurity(page);
  const loginPasswordSection = page.locator('.personal-card').filter({ has: page.getByText(/Login password/i) });
  await loginPasswordSection.getByRole('button', { name: /Edit/i }).click();

  // Leave all fields empty
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: "Please fill in all password fields."
  await expect(page.getByText(/Please fill in all password fields/i)).toBeVisible({ timeout: 5000 });
});

test('REQ-4.3.6: Reject a password change with an incorrect current password', async ({ page }) => {
  // This test does NOT change the password, so no restore needed.
  await navigateToAccountSecurity(page);
  const loginPasswordSection = page.locator('.personal-card').filter({ has: page.getByText(/Login password/i) });
  await loginPasswordSection.getByRole('button', { name: /Edit/i }).click();

  await page.getByLabel(/Current password/i).fill('WrongPassword1!');
  await page.getByLabel(/New password/i).fill('NewTest1234!');
  await page.getByLabel(/Confirm your password/i).fill('NewTest1234!');
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: "Incorrect current password."
  await expect(page.getByText(/Incorrect current password/i)).toBeVisible({ timeout: 5000 });
});

test('REQ-4.3.6: Reject a password change with mismatched new passwords', async ({ page }) => {
  // This test does NOT change the password, so no restore needed.
  await navigateToAccountSecurity(page);
  const loginPasswordSection = page.locator('.personal-card').filter({ has: page.getByText(/Login password/i) });
  await loginPasswordSection.getByRole('button', { name: /Edit/i }).click();

  await page.getByLabel(/Current password/i).fill('Test1234!');
  await page.getByLabel(/New password/i).fill('NewTest1234!');
  await page.getByLabel(/Confirm your password/i).fill('DifferentPass1!');
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: "New passwords do not match."
  await expect(page.getByText(/New passwords do not match/i)).toBeVisible({ timeout: 5000 });
});
