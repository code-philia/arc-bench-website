import { test, expect } from '@playwright/test';
import { navigateToUserInformation } from './helpers';

test('REQ-4.3.1: Open and view the user information page', async ({ page }) => {
  // GIVEN: The user is on the personal center.
  // WHEN: Click "Personal" and then click "User information".
  await navigateToUserInformation(page);

  // THEN: The page shows the sections with the corresponding fields.
  await expect(page.getByText(/Essential information/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Contact information/i)).toBeVisible();
  await expect(page.getByText(/Additional information/i)).toBeVisible();

  // Essential information fields
  await expect(page.getByText(/Account number/i)).toBeVisible();
  await expect(page.getByText(/^Name$/i)).toBeVisible();
  await expect(page.getByText(/Gender/i)).toBeVisible();
  await expect(page.getByText(/Nationality/i)).toBeVisible();
  await expect(page.getByText(/ID type/i)).toBeVisible();
  await expect(page.getByText(/ID number/i)).toBeVisible();

  // Contact information fields
  await expect(page.getByText(/Email/i)).toBeVisible();

  // Additional information fields
  await expect(page.getByText(/Passenger type/i)).toBeVisible();
});
