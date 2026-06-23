import { test, expect } from '@playwright/test';

test('REQ-1.3.1: Expand Category Menu', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  const categoryLink = page.getByRole('navigation').getByRole('link', { name: /clothes/i });
  await categoryLink.hover();

  // 3. Assertion
  const dropdown = page.getByRole('menu').or(page.locator('.dropdown-menu'));
  await expect(dropdown).toBeVisible();
  await expect(dropdown.getByRole('link', { name: /men/i })).toBeVisible();
});
