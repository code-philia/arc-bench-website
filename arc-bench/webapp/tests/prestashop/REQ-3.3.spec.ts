import { test, expect } from '@playwright/test';

test('REQ-3.3: Category Description', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // 2. Assertion
  const heading = page.getByRole('heading', { name: /clothes/i });
  await expect(heading).toBeVisible();
  
  // Verify there's some description text
  const blockContainer = page.locator('#category-description').or(page.locator('.block-category'));
  await expect(blockContainer).toBeVisible();
});
