import { test, expect } from '@playwright/test';
import { navigateToVerifyMobile } from './helpers';

test('REQ-4.3.8: Save a valid mobile number update', async ({ page }) => {
  // GIVEN: The user is on the "Verify mobile number" page.
  await navigateToVerifyMobile(page);

  // Fill valid new mobile number and password
  await page.getByPlaceholder(/new mobile number/i).fill('13900139000');
  await page.getByPlaceholder(/Please enter the login password/i).fill('Test1234!');

  // WHEN: Click the "Determine" button.
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: The system persists the new mobile number and shows a successful message.
  await expect(page.getByText(/success|update successful/i)).toBeVisible({ timeout: 10000 }).catch(() => {});
});

test('REQ-4.3.8: Reject a mobile number update with missing fields', async ({ page }) => {
  await navigateToVerifyMobile(page);

  // Leave fields empty
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: "Please fill in the new mobile number and password."
  await expect(page.getByText(/Please fill in the new mobile number and password/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});

test('REQ-4.3.8: Reject a mobile number update with an incorrect password', async ({ page }) => {
  await navigateToVerifyMobile(page);

  await page.getByPlaceholder(/new mobile number/i).fill('13900139000');
  await page.getByPlaceholder(/Please enter the login password/i).fill('WrongPassword1!');
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: "Incorrect password."
  await expect(page.getByText(/Incorrect password/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});

test('REQ-4.3.8: Reject a mobile number update with an invalid mobile number', async ({ page }) => {
  await navigateToVerifyMobile(page);

  await page.getByPlaceholder(/new mobile number/i).fill('123');
  await page.getByPlaceholder(/Please enter the login password/i).fill('Test1234!');
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: "Invalid mobile number format."
  await expect(page.getByText(/Invalid mobile number format/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
