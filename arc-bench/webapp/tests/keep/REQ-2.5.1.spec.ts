import { test, expect } from '@playwright/test';

test('REQ-2.5.1: Archive', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // Pre-condition: Create a note
  await page.getByText(/take a note/i).click();
  await page.getByPlaceholder(/title/i).fill('Note to archive');
  await page.getByRole('button', { name: /close/i }).click();

  // 2. Interaction
  const note = page.getByText('Note to archive').locator('../..').first();
  await note.hover();
  await note.getByRole('button', { name: /archive/i }).click();

  // 3. Assertion
  await expect(page.getByText(/note archived/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /undo/i })).toBeVisible();
});
