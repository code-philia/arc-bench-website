import { test, expect } from '@playwright/test';
import { navigateToForgotPasswordPage } from './helpers';

test('REQ-2.4.4: Submit the identity verification step with missing information', async ({ page }) => {
  // GIVEN: The user is on the first step of the forgot password flow with the email field empty.
  await navigateToForgotPasswordPage(page);
  // Leave email empty, fill only ID number
  await page.getByLabel(/ID number/i).fill('1234567890');

  // WHEN: Click the "submit" button.
  await page.getByRole('button', { name: /submit/i }).click();

  // THEN: The page shows "Please enter your email and ID number." and does not continue.
  await expect(page.getByText(/Please enter your email and ID number/i)).toBeVisible();
});

test('REQ-2.4.4: Submit the identity verification step with missing ID number', async ({ page }) => {
  // GIVEN: The user is on the first step with the ID number field empty.
  await navigateToForgotPasswordPage(page);
  await page.getByLabel(/Email/i).fill('testuser@example.com');

  // WHEN: Click the "submit" button.
  await page.getByRole('button', { name: /submit/i }).click();

  // THEN: The page shows "Please enter your email and ID number."
  await expect(page.getByText(/Please enter your email and ID number/i)).toBeVisible();
});

test('REQ-2.4.4: Submit the identity verification step with both fields empty', async ({ page }) => {
  // GIVEN: The user is on the first step with both fields empty.
  await navigateToForgotPasswordPage(page);

  // WHEN: Click the "submit" button.
  await page.getByRole('button', { name: /submit/i }).click();

  // THEN: The page shows "Please enter your email and ID number."
  await expect(page.getByText(/Please enter your email and ID number/i)).toBeVisible();
});
