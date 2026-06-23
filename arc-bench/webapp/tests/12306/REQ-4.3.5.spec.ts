import { test, expect } from '@playwright/test';
import { navigateToAccountSecurity } from './helpers';

test('REQ-4.3.5: Open and view the account security page', async ({ page }) => {
  // GIVEN: The user is on the personal center.
  // WHEN: Click "Personal" and then click "Account security".
  await navigateToAccountSecurity(page);

  // THEN: The page shows the entries "Login password" and "Security mailbox".
  await expect(page.getByText(/Login password/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Security mailbox/i)).toBeVisible();
});
