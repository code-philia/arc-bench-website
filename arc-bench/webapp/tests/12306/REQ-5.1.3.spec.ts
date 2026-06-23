import { test, expect } from '@playwright/test';
import { navigateToSearchResults } from './helpers';

test('REQ-5.1.3: Open the registration page from the quick login form', async ({ page }) => {
  // GIVEN: The user is viewing the quick login form.
  await navigateToSearchResults(page);
  const bookButton = page.getByRole('button', { name: /^Book$/i }).first();
  await expect(bookButton).toBeVisible({ timeout: 10000 });
  await bookButton.click();

  // Wait for quick login form
  await expect(page.getByPlaceholder(/Email\/Username\/Mobile number/i)).toBeVisible({ timeout: 5000 });

  // WHEN: Click the link "No account yet? Register now."
  await page.getByRole('link', { name: /Register now/i }).click();

  // THEN: Navigate to the registration page.
  await expect(page).toHaveURL(/register/i, { timeout: 10000 });
});
