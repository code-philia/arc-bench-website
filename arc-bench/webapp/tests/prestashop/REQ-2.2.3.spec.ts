import { test, expect } from '@playwright/test';

test('REQ-2.2.3: Click Carousel to Navigate', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  const carousel = page.getByRole('region', { name: /carousel|banner/i });
  const activeLink = carousel.locator('.carousel-item.active, [aria-hidden="false"]').getByRole('link').first();
  
  await activeLink.click();

  // 3. Assertion
  await expect(page).not.toHaveURL(/\/$/);
});
