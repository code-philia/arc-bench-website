import { test, expect } from '@playwright/test';

test('REQ-2.7.6.1: View list filtered by label', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // Pre-condition: Create a note with 'Work' label
  await page.getByText(/take a note/i).click();
  await page.getByPlaceholder(/title/i).fill('Labeled Note');
  await page.getByRole('button', { name: /close/i }).click();
  
  const note = page.getByText('Labeled Note').locator('../..').first();
  await note.hover();
  await note.getByRole('button', { name: /more options/i }).click();
  await page.getByRole('button', { name: /change labels/i }).click();
  await page.getByRole('checkbox', { name: /work/i }).check();
  await page.keyboard.press('Escape');

  // 2. Interaction
  await page.getByRole('button', { name: /work/i }).click();

  // 3. Assertion
  await expect(page.getByText('Labeled Note').first()).toBeVisible();
});
