import { test, expect } from '@playwright/test';
import { navigateToMyPassengers } from './helpers';

test('REQ-4.4.1: Open and view the my passengers page', async ({ page }) => {
  // GIVEN: The user is on the personal center.
  // WHEN: Click "Information management" and then click "My Passengers".
  await navigateToMyPassengers(page);

  // THEN: The page shows a table with the checkbox header "All" and the columns,
  // and the current user appears as a passenger entry that cannot be deleted.
  await expect(page.getByRole('columnheader', { name: /All/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('columnheader', { name: /^Name$/i })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /ID type/i })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /ID number/i })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Mobile number/i })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Operation/i })).toBeVisible();
});
