import { test, expect } from '@playwright/test';
import { navigateToMyPassengers } from './helpers';

test('REQ-4.4.2: Open the add passenger form from the passenger list page', async ({ page }) => {
  // GIVEN: The user is on the "My Passengers" page.
  await navigateToMyPassengers(page);

  // WHEN: Click the "Add new passengers" button.
  await page.getByRole('button', { name: /Add new passengers/i }).click();

  // THEN: The page shows the passenger form with the required labeled fields and buttons.
  await expect(page.getByLabel(/Nationality/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByLabel(/Name/i)).toBeVisible();
  await expect(page.getByLabel(/Passport number/i)).toBeVisible();
  await expect(page.getByLabel(/Passport expiration date/i)).toBeVisible();
  await expect(page.getByLabel(/Date of birth/i)).toBeVisible();
  await expect(page.getByLabel(/Gender/i)).toBeVisible();
  await expect(page.getByLabel(/Email/i)).toBeVisible();
  await expect(page.getByLabel(/Mobile number/i)).toBeVisible();
  await expect(page.getByLabel(/Passenger type/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Determine/i })).toBeVisible();
});
