import { test, expect } from '@playwright/test';

test('REQ-2.8.2: Unpin note', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // Pre-condition: Create and pin a note
  await page.getByText(/take a note/i).click();
  await page.getByPlaceholder(/title/i).fill('Note to unpin');
  await page.getByRole('button', { name: /close/i }).click();
  
  let note = page.getByText('Note to unpin').locator('xpath=ancestor::div[contains(@class, "group relative rounded-lg")]').first();
  await note.hover();
  await note.getByRole('button', { name: /pin note/i }).click();

  // 2. Interaction
  const pinnedSection = page.locator('section', { has: page.getByRole('heading', { name: 'Pinned' }) }).first();
  const pinnedNote = pinnedSection.getByText('Note to unpin').locator('xpath=ancestor::div[contains(@class, "group relative rounded-lg")]').first();
  await pinnedNote.hover();
  await pinnedNote.getByRole('button', { name: /unpin note/i }).click();

  // 3. Assertion
  await expect(pinnedSection.getByText('Note to unpin').first()).not.toBeVisible();
});
