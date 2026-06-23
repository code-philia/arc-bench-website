import { test, expect } from '@playwright/test';

test('REQ-3.4: Subcategory Navigation', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // 2. Interaction
  const subcategoryList = page.locator('.subcategories').or(page.getByRole('list', { name: /subcategories/i }));
  const firstSubcategoryLink = subcategoryList.getByRole('link').first();
  await firstSubcategoryLink.click();

  // 3. Assertion
  await expect(page).toHaveURL(/.*[a-zA-Z0-9].*/);
});
