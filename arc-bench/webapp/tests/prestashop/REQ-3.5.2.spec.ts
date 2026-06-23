import { test, expect } from '@playwright/test';

test('REQ-3.5.2: Hover to Show Action Buttons', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // 2. Interaction
  const firstProduct = page.locator('article').first();
  await firstProduct.hover();

  // 3. Assertion
  await expect(firstProduct.getByRole('button', { name: /quick view/i }).or(firstProduct.getByText(/quick view/i))).toBeVisible();
});
