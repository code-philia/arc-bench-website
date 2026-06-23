import { test, expect } from '@playwright/test';

test('REQ-2.5.4: Unarchive', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // Pre-condition: Create and archive a note, then go to archive list
  await page.getByText(/take a note/i).click();
  await page.getByPlaceholder(/title/i).fill('Note to unarchive');
  await page.getByRole('button', { name: /close/i }).click();
  
  const note = page.getByText('Note to unarchive').locator('../..').first();
  await note.hover();
  await note.getByRole('button', { name: /archive/i }).click();

  await page.getByRole('navigation').getByRole('button', { name: /archive/i }).click();

  // 2. Interaction
  const archivedNote = page.getByText('Note to unarchive').locator('../..').first();
  await archivedNote.hover();
  await archivedNote.getByRole('button', { name: /unarchive|restore/i }).click();

  // 3. Assertion
  await page.getByRole('button', { name: /notes/i }).click();
  await expect(page.getByText('Note to unarchive').first()).toBeVisible();
});
