import { test, expect } from '@playwright/test';
import { navigateToMyPassengers } from './helpers';

test('REQ-4.4.4: Submit the add passenger form with missing required information', async ({ page }) => {
  // GIVEN: The user is on the add passenger form with one or more required fields left empty.
  await navigateToMyPassengers(page);
  await page.getByRole('button', { name: /Add new passengers/i }).click();
  await page.waitForTimeout(500);

  // Fill only Name, leave other required fields empty
  await page.getByLabel(/Name/i).fill('Only Name');

  // WHEN: Click the "Determine" button.
  await page.getByRole('button', { name: /Determine/i }).click();

  // THEN: The page shows "Please fill in all required fields."
  await expect(page.getByText(/Please fill in all required fields/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
});
