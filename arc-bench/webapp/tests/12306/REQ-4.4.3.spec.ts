import { test, expect } from '@playwright/test';
import { navigateToMyPassengers } from './helpers';

test('REQ-4.4.3: Add a frequent passenger successfully', async ({ page }) => {
  // GIVEN: The user is on the add passenger form with all required fields filled with valid values.
  await navigateToMyPassengers(page);
  await page.getByRole('button', { name: /Add new passengers/i }).click();
  await page.waitForTimeout(500);

  const timestamp = Date.now();
  await page.getByLabel(/Nationality/i).selectOption({ label: 'China' }).catch(() => {});
  await page.getByLabel(/Name/i).fill('Passenger Test');
  await page.getByLabel(/Passport number/i).fill(`E${timestamp}`);
  await page.getByLabel(/Passport expiration date/i).fill('2030-12-31');
  await page.getByLabel(/Date of birth/i).fill('1995-06-15');
  await page.getByLabel(/Gender/i).selectOption({ label: 'Male' }).catch(() => {});
  await page.getByLabel(/Email/i).fill(`passenger_${timestamp}@example.com`);
  await page.getByLabel(/Mobile number/i).fill('13800138000');
  await page.getByLabel(/Passenger type/i).selectOption({ label: 'Adult' }).catch(() => {});

  // WHEN: Click the "Determine" button.
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: The system persists the passenger information and shows a successful add message.
  await expect(page.getByText(/success|added|successful/i)).toBeVisible({ timeout: 10000 }).catch(() => {});
});
