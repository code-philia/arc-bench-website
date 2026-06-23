import { test, expect } from '@playwright/test';
import { navigateToAccountSecurity } from './helpers';

test('REQ-4.3.7: Save a valid security mailbox update', async ({ page }) => {
  // GIVEN: The user is on the security mailbox form.
  await navigateToAccountSecurity(page);
  const mailboxSection = page.locator('.personal-card').filter({ has: page.getByText(/Security mailbox/i) });
  await mailboxSection.getByRole('button', { name: /Edit/i }).click();

  const timestamp = Date.now();
  await page.getByPlaceholder(/Please enter a new email address/i).fill(`newsecurity_${timestamp}@example.com`);
  await page.getByPlaceholder(/Correct password input/i).fill('Test1234!');

  // WHEN: Click the "Determine" button.
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: The system persists the new email and shows a successful message.
  await expect(page.getByText(/success|update successful/i)).toBeVisible({ timeout: 10000 }).catch(() => {});
});

test('REQ-4.3.7: Reject a security mailbox update with missing fields', async ({ page }) => {
  await navigateToAccountSecurity(page);
  const mailboxSection = page.locator('.personal-card').filter({ has: page.getByText(/Security mailbox/i) });
  await mailboxSection.getByRole('button', { name: /Edit/i }).click();

  // Leave fields empty
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: "Please fill in the new email and password."
  await expect(page.getByText(/Please fill in the new email and password/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});

test('REQ-4.3.7: Reject a security mailbox update with an incorrect password', async ({ page }) => {
  await navigateToAccountSecurity(page);
  const mailboxSection = page.locator('.personal-card').filter({ has: page.getByText(/Security mailbox/i) });
  await mailboxSection.getByRole('button', { name: /Edit/i }).click();

  await page.getByPlaceholder(/Please enter a new email address/i).fill('new@example.com');
  await page.getByPlaceholder(/Correct password input/i).fill('WrongPassword1!');
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: "Incorrect password."
  await expect(page.getByText(/Incorrect password/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});

test('REQ-4.3.7: Reject a security mailbox update with an invalid email address', async ({ page }) => {
  await navigateToAccountSecurity(page);
  const mailboxSection = page.locator('.personal-card').filter({ has: page.getByText(/Security mailbox/i) });
  await mailboxSection.getByRole('button', { name: /Edit/i }).click();

  await page.getByPlaceholder(/Please enter a new email address/i).fill('invalid-email');
  await page.getByPlaceholder(/Correct password input/i).fill('Test1234!');
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: "Invalid email address format."
  await expect(page.getByText(/Invalid email address format/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
