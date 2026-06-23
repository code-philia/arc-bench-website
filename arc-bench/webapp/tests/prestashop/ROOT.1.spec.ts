import { test, expect } from '@playwright/test';

test('ROOT.1: Visit Homepage', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Assertion
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('region', { name: /carousel|banner/i })).toBeVisible();
  await expect(page.getByRole('region', { name: /products/i })).toBeVisible();
});
