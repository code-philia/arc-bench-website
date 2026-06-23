import { test, expect } from '@playwright/test';

test('REQ-2.3.1: Delete Note', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // Pre-condition: Create a note
  await page.getByText(/take a note/i).click();
  await page.getByPlaceholder(/title/i).fill('Note to delete');
  await page.getByRole('button', { name: /close/i }).click();

  // 2. Interaction
  const note = page.getByText('Note to delete').locator('../..').first();
  await note.hover();
  await note.getByRole('button', { name: /more options/i }).click();
  await page.getByRole('button', { name: /delete note/i }).click();

  // 3. Assertion
  await expect(page.getByText(/note trashed/i)).toBeVisible();
});
