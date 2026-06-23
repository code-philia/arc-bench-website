import { test, expect } from '@playwright/test';

test('REQ-1.4: Search Function', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  const searchBox = page.getByRole('searchbox');
  await searchBox.click();
  await expect(searchBox).toBeFocused();

  await searchBox.fill('shirt');
  // Wait for dropdown suggestion
  await expect(page.getByRole('listbox').or(page.locator('.ui-autocomplete'))).toBeVisible();

  await searchBox.press('Enter');

  // 3. Assertion
  await expect(page).toHaveURL(/.*search.*shirt.*/i);
});
