import { test, expect } from '@playwright/test';
import { navigateToLoginPage } from './helpers';

test('REQ-2.2.3: Log in with valid credentials', async ({ page }) => {
  // GIVEN: The user is on the login page with a valid username and the correct password.
  await navigateToLoginPage(page);
  await page.getByPlaceholder(/Email\/Username\/Mobile number/i).fill('testuser');
  await page.getByPlaceholder(/^Password$/i).fill('Test1234!');

  // WHEN: Click the "LOGIN" button.
  await page.getByRole('button', { name: /LOGIN/i }).click();

  // THEN: The system persists the login state and shows a successful login message.
  await expect(page.getByText(/success|Welcome|logged in|Login successful/i)).toBeVisible({ timeout: 10000 });
});
