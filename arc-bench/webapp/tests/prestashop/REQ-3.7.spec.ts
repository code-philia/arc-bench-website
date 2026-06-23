import { test, expect } from '@playwright/test';

test('REQ-3.7: Sort Function', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: /clothes/i }).click();

  // 2. Interaction
  const sortDropdown = page.getByRole('button', { name: /sort by/i });
  await sortDropdown.click();
  
  await page.getByRole('link', { name: /price, low to high/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/.*order=product.price.asc.*/i);
});
