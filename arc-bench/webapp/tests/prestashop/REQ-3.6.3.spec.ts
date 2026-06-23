import { test, expect } from '@playwright/test';

test('REQ-3.6.3: Filter by Price Range', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // 2. Interaction
  const filterSection = page.locator('#search_filters').or(page.getByRole('complementary', { name: /filter/i }));
  const slider = filterSection.locator('.ui-slider-handle').first();
  
  // Drag slider right
  await slider.hover();
  await page.mouse.down();
  await page.mouse.move(100, 0);
  await page.mouse.up();

  // 3. Assertion
  await expect(page).toHaveURL(/.*q=Price-.*/i);
});
