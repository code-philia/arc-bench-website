import { test, expect } from '@playwright/test';

test('REQ-3.1: Enter Category Page', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/.*clothes.*/i);
  await expect(page.getByRole('heading', { name: /clothes/i })).toBeVisible();
});
