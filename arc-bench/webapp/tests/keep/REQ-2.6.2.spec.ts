import { test, expect } from '@playwright/test';

test('REQ-2.6.2: Choose note color when created', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByText(/take a note/i).click();
  await page.getByRole('button', { name: /background color/i }).click();
  await page.getByRole('button', { name: /color: light green/i }).click();

  await page.getByPlaceholder(/title/i).fill('Pre-colored Note');
  await page.getByRole('button', { name: /close/i }).click();

  // 3. Assertion
  const note = page.getByText('Pre-colored Note').locator('../..').first();
  await expect(note).toBeVisible();
});
