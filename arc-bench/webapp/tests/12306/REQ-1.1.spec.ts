import { test, expect } from '@playwright/test';
import { navigateToHomePage } from './helpers';

test('REQ-1.1: Display the default home page', async ({ page }) => {
  // GIVEN: The system is accessible.
  // WHEN: Open the application entry URL.
  await navigateToHomePage(page);

  // THEN: The page shows the logo, auth links, navigation, banners, search area, and Quick Guide area.

  // Logo at top-left
  await expect(page.getByRole('img', { name: /logo/i })).toBeVisible();

  // Authentication links at top-right
  await expect(page.getByRole('link', { name: /Login/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Register/i })).toBeVisible();

  // "My 12306" dropdown entry
  await expect(page.getByText(/My 12306/i)).toBeVisible();

  // Navigation items
  await expect(page.getByRole('link', { name: /Home/i })).toBeVisible();
  await expect(page.getByText(/Booking/i)).toBeVisible();
  await expect(page.getByText(/Travel guides/i)).toBeVisible();

  // Three banner images
  const bannerImages = page.locator('img[src*="banner"]');
  await expect(bannerImages).toHaveCount(3);

  // Search area (inputs with placeholders From, To, Date and Search button)
  await expect(page.getByPlaceholder(/From/i)).toBeVisible();
  await expect(page.getByPlaceholder(/^To$/i)).toBeVisible();
  await expect(page.getByPlaceholder(/Date/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Search/i })).toBeVisible();

  // Quick Guide area
  await expect(page.getByText(/Quick Guide/i)).toBeVisible();
});
