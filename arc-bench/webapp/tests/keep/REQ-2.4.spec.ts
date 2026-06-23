import { test, expect } from '@playwright/test';

test('REQ-2.4: Update Note', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // Pre-condition: Create a note
  await page.getByText(/take a note/i).click();
  await page.getByPlaceholder(/title/i).fill('Old Title');
  await page.getByRole('button', { name: /close/i }).click();

  // 2. Interaction
  await page.getByText('Old Title').first().click();
  await page.getByPlaceholder(/title/i).fill('Updated Title');
  await page.getByRole('textbox', { name: /note/i }).last().fill('Updated Content');
  await page.getByRole('button', { name: /close/i }).click();

  // 3. Assertion
  await expect(page.getByText('Updated Title').first()).toBeVisible();
  await expect(page.getByText('Updated Content').first()).toBeVisible();
});
