import { test, expect } from '@playwright/test';

test('REQ-2.8.1: Pin note', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // Pre-condition: Create a note
  await page.getByText(/take a note/i).click();
  await page.getByPlaceholder(/title/i).fill('Note to pin');
  await page.getByRole('button', { name: /close/i }).click();

  // 2. Interaction
  const note = page.getByText('Note to pin').locator('../..').first();
  await note.hover();
  await note.getByRole('button', { name: /pin note/i }).click();

  // 3. Assertion
  await expect(page.getByText(/pinned/i).first()).toBeVisible();
  const pinnedSection = page.getByText(/pinned/i).first().locator('..');
  await expect(pinnedSection.getByText('Note to pin')).toBeVisible();
});
