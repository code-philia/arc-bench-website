import { test, expect } from '@playwright/test';

test('REQ-3-3-3: Edit Summary and Revision History', async ({ page }) => {
  // 1. Pre-condition: Login & Navigate to edit
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('author@example.com');
  await page.getByRole('textbox', { name: /password/i }).fill('password123');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.goto('/questions/1/edit');

  // 2. Interaction & Assertion
  const summaryInput = page.getByLabel(/edit summary/i).or(page.getByPlaceholder(/edit summary/i));
  await summaryInput.fill('Fixed a typo in the second paragraph');
  await expect(summaryInput).toHaveValue('Fixed a typo in the second paragraph');
});
