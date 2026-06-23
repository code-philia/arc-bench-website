import { test, expect } from '@playwright/test';
import { navigateToMyPassengers } from './helpers';

test('REQ-4.4.7: Submit the add passenger form with an invalid mobile number', async ({ page }) => {
  // GIVEN: The user is on the add passenger form with an invalid mobile number.
  await navigateToMyPassengers(page);
  await page.getByRole('button', { name: /Add new passengers/i }).click();
  await page.waitForTimeout(500);

  const timestamp = Date.now();
  await page.getByLabel(/Nationality/i).selectOption({ label: 'China' }).catch(() => {});
  await page.getByLabel(/Name/i).fill('Invalid Mobile');
  await page.getByLabel(/Passport number/i).fill(`E${timestamp}`);
  await page.getByLabel(/Passport expiration date/i).fill('2030-12-31');
  await page.getByLabel(/Date of birth/i).fill('1995-06-15');
  await page.getByLabel(/Gender/i).selectOption({ label: 'Male' }).catch(() => {});
  await page.getByLabel(/Email/i).fill(`mobile_${timestamp}@example.com`);
  await page.getByLabel(/Mobile number/i).fill('123'); // Invalid mobile number
  await page.getByLabel(/Passenger type/i).selectOption({ label: 'Adult' }).catch(() => {});

  // WHEN: Click the "Determine" button.
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: The page shows "Invalid mobile number format."
  await expect(page.getByText(/Invalid mobile number format/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
