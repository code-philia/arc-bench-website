import { test, expect } from '@playwright/test';

test('ROOT.1: Enter Platform', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Assertion: Display the homepage with header, sidebar navigation, and main question feed
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation', { name: /sidebar|navigation/i }).first()).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
});
