import { test, expect } from '@playwright/test';

test('REQ-2.7.5: Edit labels', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('button', { name: /edit labels/i }).click();
  
  // Create a new label
  await page.getByPlaceholder(/create new label/i).fill('New Custom Label');
  // Click done directly
  await page.getByRole('button', { name: /done/i }).click();

  // 3. Assertion
  await expect(page.getByRole('navigation').getByText(/new custom label/i)).toBeVisible();
});
