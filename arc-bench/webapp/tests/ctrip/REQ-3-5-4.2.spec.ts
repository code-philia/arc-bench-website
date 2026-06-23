import { test, expect } from '@playwright/test';

test('REQ-3-5-4.2: Select a Fare and Book', async ({ page }) => {
  // 1. Navigation
  await page.goto('/flight/list');

  // Wait for flights to load
  await page.getByRole('listitem').first().waitFor({ timeout: 10000 });

  // 2. Interaction
  await page.getByRole('button', { name: /展开/i }).first().click();
  await page.getByRole('button', { name: /预订/i }).first().click();

  // 3. Assertion
  await expect(page).toHaveURL(/book/i);
});
