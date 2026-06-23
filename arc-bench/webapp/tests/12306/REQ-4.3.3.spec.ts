import { test, expect } from '@playwright/test';
import { navigateToUserInformation } from './helpers';

test('REQ-4.3.3: Save a new email address in the contact information section', async ({ page }) => {
  // GIVEN: The user is on the "User information" page.
  await navigateToUserInformation(page);

  // WHEN: Click the "Edit" button in the "Contact information" section.
  const contactSection = page.locator('.personal-card').filter({ has: page.getByText(/Contact information/i) });
  await contactSection.getByRole('button', { name: /^Edit$/i }).click();

  // Enter a new email address
  const emailInput = contactSection.getByLabel(/Email/i).or(contactSection.getByPlaceholder(/email/i));
  const timestamp = Date.now();
  await emailInput.fill(`newemail_${timestamp}@example.com`);

  // Click "Save"
  await contactSection.getByRole('button', { name: /^Save$/i }).click();

  // THEN: The section returns to display mode and shows the saved email address.
  await expect(contactSection.getByRole('button', { name: /^Edit$/i })).toBeVisible({ timeout: 5000 });
});
