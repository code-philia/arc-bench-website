import { test, expect } from '@playwright/test';

test('REQ-2.1: Browse Homepage', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Assertion
  await expect(page.getByRole('region', { name: /carousel|banner/i })).toBeVisible();
  await expect(page.getByRole('region', { name: /popular products/i }).or(page.getByText(/popular products/i))).toBeVisible();
  await expect(page.getByRole('form', { name: /newsletter/i }).or(page.getByText(/newsletter/i))).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible(); // Footer
});
