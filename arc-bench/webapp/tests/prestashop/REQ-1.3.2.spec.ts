import { test, expect } from '@playwright/test';

test('REQ-1.3.2: Enter Subcategory', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  const categoryLink = page.getByRole('navigation').getByRole('link', { name: /clothes/i });
  await categoryLink.hover();
  
  const dropdown = page.getByRole('menu').or(page.locator('.dropdown-menu'));
  await dropdown.getByRole('link', { name: /men/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/.*men.*/i);
});
