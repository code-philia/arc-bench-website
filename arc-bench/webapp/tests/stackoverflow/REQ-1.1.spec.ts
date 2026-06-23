import { test, expect } from '@playwright/test';

test('REQ-1.1: View Homepage Total Layout', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Assertion: Display the multi-column homepage layout
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation').first()).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
});
