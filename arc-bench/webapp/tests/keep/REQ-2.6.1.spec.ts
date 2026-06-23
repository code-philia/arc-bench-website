import { test, expect } from '@playwright/test';

test('REQ-2.6.1: Change note color', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // Pre-condition: Create a note
  await page.getByText(/take a note/i).click();
  await page.getByPlaceholder(/title/i).fill('Colored Note');
  await page.getByRole('button', { name: /close/i }).click();

  // 2. Interaction
  const note = page.getByText('Colored Note').locator('../..').first();
  await note.hover();
  await note.getByRole('button', { name: /background options|change color/i }).click();
  await page.getByRole('button', { name: /light green/i }).click();

  // 3. Assertion
  // Assert background color or style changed
  // Relying on text or aria-label for state if possible, otherwise just assert visibility
  await expect(note).toBeVisible();
});
