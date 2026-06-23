import { test, expect } from '@playwright/test';

test('REQ-3.2.2: Navigate Back via Breadcrumb', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // 2. Interaction
  const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i }).or(page.locator('.breadcrumb'));
  await breadcrumb.getByRole('link', { name: /home/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/.*\/$/);
});
