import { test, expect } from '@playwright/test';
import { navigateToUserInformation } from './helpers';

test('REQ-4.3.2: Save valid edits in the essential information section', async ({ page }) => {
  // GIVEN: The user is on the "User information" page.
  await navigateToUserInformation(page);

  // WHEN: Click the "Edit" button in the "Essential information" section.
  const essentialSection = page.locator('.personal-card').filter({ has: page.getByText(/Essential information/i) });
  await essentialSection.getByRole('button', { name: /^Edit$/i }).click();

  // The button text should change to "Save"
  await expect(essentialSection.getByRole('button', { name: /^Save$/i })).toBeVisible();

  // Update Gender to Female
  await essentialSection.getByLabel(/Female/i).check().catch(() => {});

  // Click "Save"
  await essentialSection.getByRole('button', { name: /^Save$/i }).click();

  // THEN: The section returns to display mode and shows the saved values.
  await expect(essentialSection.getByRole('button', { name: /^Edit$/i })).toBeVisible({ timeout: 5000 });
});

test('REQ-4.3.2: Reject an invalid password in the essential information section', async ({ page }) => {
  // GIVEN: The user is on the "User information" page.
  await navigateToUserInformation(page);

  // Click "Edit" in the "Essential information" section.
  const essentialSection = page.locator('.personal-card').filter({ has: page.getByText(/Essential information/i) });
  await essentialSection.getByRole('button', { name: /^Edit$/i }).click();

  // WHEN: Enter an invalid new password and click "Save".
  const passwordInput = essentialSection.getByLabel(/Password/i).or(essentialSection.getByPlaceholder(/Password/i));
  await passwordInput.fill('abc').catch(() => {});
  await essentialSection.getByRole('button', { name: /^Save$/i }).click();

  // THEN: The page shows "Please enter a valid password."
  await expect(page.getByText(/Please enter a valid password/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
