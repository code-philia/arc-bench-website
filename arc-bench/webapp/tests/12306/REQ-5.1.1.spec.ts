import { test, expect } from '@playwright/test';
import { navigateToSearchResults } from './helpers';

test('REQ-5.1.1: Show the quick login form for an unauthenticated booking attempt', async ({ page }) => {
  // GIVEN: The user is not logged in and is on a populated ticket search results page.
  await navigateToSearchResults(page);

  // WHEN: Click one "Book" button.
  const bookButton = page.getByRole('button', { name: /^Book$/i }).first();
  await expect(bookButton).toBeVisible({ timeout: 10000 });
  await bookButton.click();

  // THEN: The page shows the quick login form with the account input, password input, and LOGIN button.
  await expect(page.getByRole('heading', { name: /Login/i })).toBeVisible({ timeout: 5000 });
  await expect(page.getByPlaceholder(/Email\/Username\/Mobile number/i)).toBeVisible();
  await expect(page.getByPlaceholder(/^Password$/i)).toBeVisible();
  await expect(page.locator('.quick-login-modal').getByRole('button', { name: /^LOGIN$/i })).toBeVisible();
});
