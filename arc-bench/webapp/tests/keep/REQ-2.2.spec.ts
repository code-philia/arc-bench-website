import { test, expect } from '@playwright/test';

test('REQ-2.2: Create Note', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByText(/take a note/i).click();
  await page.getByPlaceholder(/title/i).fill('My New Note');
  await page.getByRole('textbox', { name: /take a note/i }).fill('This is the content.');
  await page.getByRole('button', { name: /close/i }).click();

  // 3. Assertion
  const note = page.getByText('My New Note').locator('../..').first();
  await expect(note).toBeVisible();
  await expect(note.getByText('This is the content.')).toBeVisible();
});
