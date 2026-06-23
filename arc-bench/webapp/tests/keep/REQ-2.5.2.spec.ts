import { test, expect } from '@playwright/test';

test('REQ-2.5.2: Archive Undo', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // Pre-condition: Create and archive a note
  await page.getByText(/take a note/i).click();
  await page.getByPlaceholder(/title/i).fill('Note to undo archive');
  await page.getByRole('button', { name: /close/i }).click();
  const note = page.getByText('Note to undo archive').locator('../..').first();
  await note.hover();
  await note.getByRole('button', { name: /archive/i }).click();

  // 2. Interaction
  await page.getByRole('button', { name: /undo/i }).click();

  // 3. Assertion
  await expect(page.getByText('Note to undo archive').first()).toBeVisible();
});
