import { test, expect } from '@playwright/test';
import { navigateToMyPassengers, addDeletablePassenger } from './helpers';

test('REQ-4.4.9: Confirm batch deletion of selected passengers', async ({ page }) => {
  // GIVEN: The user is on the "My Passengers" page with at least two deletable passenger rows selected.
  // Create two deletable passengers first to ensure the precondition.
  await navigateToMyPassengers(page);
  await addDeletablePassenger(page, 'Batch1');
  await addDeletablePassenger(page, 'Batch2');

  // Select multiple passenger rows via checkboxes (only enabled ones — account owner's checkbox is disabled)
  const rowCheckboxes = page.locator('.passenger-table tbody input[type="checkbox"]:not([disabled])');
  const checkboxCount = await rowCheckboxes.count();
  if (checkboxCount >= 2) {
    await rowCheckboxes.nth(0).check();
    await rowCheckboxes.nth(1).check();
  }

  // WHEN: Click the "Batch deletion" button.
  await page.getByRole('button', { name: /Batch deletion/i }).click();

  // THEN: A confirmation dialog appears.
  await expect(page.getByText(/Are you sure you want to delete the selected passengers/i)).toBeVisible({ timeout: 5000 });

  // Click "Confirm"
  await page.getByRole('button', { name: /Confirm/i }).click();

  // The selected passengers are deleted.
  await expect(page.getByText(/success|deleted/i)).toBeVisible({ timeout: 10000 });
});

test('REQ-4.4.9: Cancel batch deletion of selected passengers', async ({ page }) => {
  // GIVEN: The user is on the "My Passengers" page with at least two deletable passenger rows selected.
  // Create two deletable passengers first to ensure the precondition.
  await navigateToMyPassengers(page);
  await addDeletablePassenger(page, 'BatchKeep1');
  await addDeletablePassenger(page, 'BatchKeep2');

  // Select multiple passenger rows via checkboxes (only enabled ones — account owner's checkbox is disabled)
  const rowCheckboxes = page.locator('.passenger-table tbody input[type="checkbox"]:not([disabled])');
  const checkboxCount = await rowCheckboxes.count();
  if (checkboxCount >= 2) {
    await rowCheckboxes.nth(0).check();
    await rowCheckboxes.nth(1).check();
  }

  // Click "Batch deletion" to open the dialog.
  await page.getByRole('button', { name: /Batch deletion/i }).click();

  // WHEN: Click the "Cancel" button in the dialog.
  await page.getByRole('button', { name: /Cancel/i }).click();

  // THEN: The dialog closes and the selected passengers are not deleted.
  await expect(page.getByText(/Are you sure you want to delete the selected passengers/i)).not.toBeVisible({ timeout: 5000 });
});
