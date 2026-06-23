import { test, expect } from '@playwright/test';

test('REQ-2.7.4: Assign default label when creating note', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByText(/take a note/i).click();
  
  // scope to the form to avoid sidebar elements
  const form = page.getByPlaceholder(/take a note/i).locator('xpath=ancestor::div[contains(@class, "rounded-lg")]').first();
  await form.getByRole('button', { name: /remind me|reminders/i }).click();
  
  await page.getByPlaceholder(/title/i).fill('Reminder Note');
  await page.getByRole('button', { name: /close/i }).click();

  // 3. Assertion
  const note = page.getByText('Reminder Note').locator('..').first();
  await expect(note.getByText(/reminders/i)).toBeVisible();
});
