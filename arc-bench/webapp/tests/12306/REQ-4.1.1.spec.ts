import { test, expect } from '@playwright/test';
import { navigateToHomePage } from './helpers';

test('REQ-4.1.1: Block personal center access for an unauthenticated user', async ({ page }) => {
  // GIVEN: The user is not logged in and is on the home page.
  await navigateToHomePage(page);

  // WHEN: Click the top "My 12306" entry.
  await page.getByRole('button', { name: /My 12306/i }).click();

  // THEN: Navigate to the login page.
  await expect(page).toHaveURL(/login/i, { timeout: 10000 });
});
