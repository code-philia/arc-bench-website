import { test, expect } from '@playwright/test';

test('REQ-2.7.2: Remove label from a note', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // Pre-condition: Create a note and assign label
  await page.getByText(/take a note/i).click();
  await page.getByPlaceholder(/title/i).fill('Note to unlabel 1');
  await page.getByRole('button', { name: /close/i }).click();
  
  const note = page.getByText('Note to unlabel 1').locator('../..').first();
  await note.hover();
  await note.getByRole('button', { name: /more options/i }).click();
  await page.getByRole('button', { name: /change labels|add label/i }).click();
  await page.getByRole('checkbox', { name: /work/i }).check();
  await page.locator('body').click({ position: { x: 0, y: 0 } });

  // 2. Interaction
  await note.hover();
  await note.getByRole('button', { name: /more options/i }).click();
  await page.getByRole('button', { name: /change labels|add label/i }).click();
  await page.getByRole('checkbox', { name: /work/i }).uncheck();
  await page.locator('body').click({ position: { x: 0, y: 0 } });

  // 3. Assertion
  await expect(note.getByText(/work/i)).not.toBeVisible();
});
