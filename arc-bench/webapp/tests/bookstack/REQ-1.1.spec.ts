import { test, expect } from '@playwright/test';

test('REQ-1.1: Open Homepage', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  // No explicit interaction required for opening the homepage

  // 3. Assertion
  await expect(page).toHaveURL(/\//);
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('searchbox')).toBeVisible();
});
