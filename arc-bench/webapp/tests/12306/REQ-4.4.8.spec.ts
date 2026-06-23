import { test, expect } from '@playwright/test';
import { navigateToMyPassengers, addDeletablePassenger } from './helpers';

test('REQ-4.4.8: Confirm deletion of one passenger', async ({ page }) => {
  // GIVEN: The user is on the "My Passengers" page and there is at least one deletable passenger row.
  // Create a deletable passenger first to ensure the precondition.
  await navigateToMyPassengers(page);
  await addDeletablePassenger(page, 'ToDelete');

  // WHEN: Click the "Delete" button for one passenger row.
  const deleteButton = page.getByRole('button', { name: /Delete/i }).first();
  await expect(deleteButton).toBeVisible({ timeout: 5000 });
  await deleteButton.click();

  // THEN: A confirmation dialog appears.
  await expect(page.getByText(/Are you sure you want to delete this passenger/i)).toBeVisible({ timeout: 5000 });

  // Click "Confirm"
  await page.getByRole('button', { name: /Confirm/i }).click();

  // The passenger is deleted and the page shows a successful delete message.
  await expect(page.getByText(/success|deleted/i)).toBeVisible({ timeout: 10000 });
});

test('REQ-4.4.8: Cancel deletion of one passenger', async ({ page }) => {
  // GIVEN: The user is on the "My Passengers" page with at least one deletable passenger row.
  // Create a deletable passenger first to ensure the precondition.
  await navigateToMyPassengers(page);
  await addDeletablePassenger(page, 'ToKeep');

  // Click "Delete" to open the confirmation dialog.
  const deleteButton = page.getByRole('button', { name: /Delete/i }).first();
  await expect(deleteButton).toBeVisible({ timeout: 5000 });
  await deleteButton.click();

  // WHEN: Click the "Cancel" button in the dialog.
  await page.getByRole('button', { name: /Cancel/i }).click();

  // THEN: The dialog closes and the passenger is not deleted.
  await expect(page.getByText(/Are you sure you want to delete this passenger/i)).not.toBeVisible({ timeout: 5000 });
});
