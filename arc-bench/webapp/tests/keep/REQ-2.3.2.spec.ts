import { test, expect } from '@playwright/test';

test('REQ-2.3.2: Notification and Undo', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // Pre-condition: Create and delete a note
  await page.getByText(/take a note/i).click();
  await page.getByPlaceholder(/title/i).fill('Note to undo delete');
  await page.getByRole('button', { name: /close/i }).click();
  const note = page.getByText('Note to undo delete').locator('../..').first();
  await note.hover();
  await note.getByRole('button', { name: /more options/i }).click();
  await page.getByRole('button', { name: /delete note/i }).click();

  // 2. Interaction
  await page.getByRole('button', { name: /undo/i }).click();

  // 3. Assertion
  await expect(page.getByText(/action undone/i)).toBeVisible();
  await expect(page.getByText('Note to undo delete').first()).toBeVisible();
});
