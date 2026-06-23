import { test, expect } from '@playwright/test';

test('REQ-1.6.2: Click to Enter Cart', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('banner').getByRole('link', { name: /cart/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/.*cart.*/i);
});
