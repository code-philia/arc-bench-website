import { test, expect } from '@playwright/test';

test('REQ-9.1: Quick Navigation from Recently Updated', async ({ page }) => {
  // 1. Navigation
  await page.goto('/'); // Homepage contains "Recently Updated Pages" list

  // 2. Interaction
  // Target the 'Recently Updated Pages' section
  const recentlyUpdatedSection = page.getByRole('heading', { name: /Recently Updated Pages/i }).locator('..');
  
  // Find the first recently updated page link and click it
  const firstUpdatedPage = recentlyUpdatedSection.getByRole('link').first();
  await firstUpdatedPage.click();

  // 3. Assertion
  // Should navigate to the reading view of that page
  await expect(page).toHaveURL(/\/books\/.+\/page\/.+/); // Expected URL structure for a page
  await expect(page.getByRole('heading')).toBeVisible(); // Target page loads
});
