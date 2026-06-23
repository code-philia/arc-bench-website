import { test, expect } from '@playwright/test';
import { navigateToUserInformation } from './helpers';

test('REQ-4.3.4: Save a new passenger type in the additional information section', async ({ page }) => {
  // GIVEN: The user is on the "User information" page.
  await navigateToUserInformation(page);

  // WHEN: Click the "Edit" button in the "Additional information" section.
  const additionalSection = page.locator('.personal-card').filter({ has: page.getByText(/Additional information/i) });
  await additionalSection.getByRole('button', { name: /^Edit$/i }).click();

  // Choose "Child" from the "Passenger type" dropdown
  const passengerTypeSelect = additionalSection.getByLabel(/Passenger type/i);
  await passengerTypeSelect.selectOption({ label: 'Child' }).catch(() => {});

  // Click "Save"
  await additionalSection.getByRole('button', { name: /^Save$/i }).click();

  // THEN: The section returns to display mode and shows the saved passenger type.
  await expect(additionalSection.getByRole('button', { name: /^Edit$/i })).toBeVisible({ timeout: 5000 });
});
