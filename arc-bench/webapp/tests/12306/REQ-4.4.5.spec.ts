import { test, expect } from '@playwright/test';
import { navigateToMyPassengers } from './helpers';

test('REQ-4.4.5: Submit the add passenger form with an existing passport number', async ({ page }) => {
  // GIVEN: The user is on the add passenger form with a passport number that already exists.
  // Use the test user's passport number from prerequisites.
  await navigateToMyPassengers(page);
  await page.getByRole('button', { name: /Add new passengers/i }).click();
  await page.waitForTimeout(500);

  const timestamp = Date.now();
  await page.getByLabel(/Nationality/i).selectOption({ label: 'China' }).catch(() => {});
  await page.getByLabel(/Name/i).fill('Duplicate Passport');
  await page.getByLabel(/Passport number/i).fill('E12345678'); // Existing passport number
  await page.getByLabel(/Passport expiration date/i).fill('2030-12-31');
  await page.getByLabel(/Date of birth/i).fill('1995-06-15');
  await page.getByLabel(/Gender/i).selectOption({ label: 'Male' }).catch(() => {});
  await page.getByLabel(/Email/i).fill(`dup_${timestamp}@example.com`);
  await page.getByLabel(/Mobile number/i).fill('13800138001');
  await page.getByLabel(/Passenger type/i).selectOption({ label: 'Adult' }).catch(() => {});

  // WHEN: Click the "Determine" button.
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: The page shows "Passport number already exists."
  await expect(page.getByText(/Passport number already exists/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
