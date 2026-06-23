import { test, expect } from '@playwright/test';

test('REQ-3.2.1: View Breadcrumb Navigation', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // 2. Assertion
  const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i }).or(page.locator('.breadcrumb'));
  await expect(breadcrumb).toBeVisible();
  await expect(breadcrumb.getByRole('link', { name: /home/i })).toBeVisible();
  await expect(breadcrumb.getByText(/clothes/i)).toBeVisible();
});
