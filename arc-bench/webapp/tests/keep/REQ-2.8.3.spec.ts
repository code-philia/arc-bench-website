import { test, expect } from '@playwright/test';

test('REQ-2.8.3: Pin note when creating it', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByText(/take a note/i).click();
  await page.getByPlaceholder(/title/i).fill('Pinned Created Note');
  
  // scope to the form to avoid strict mode violation
  const form = page.getByPlaceholder(/title/i).locator('xpath=ancestor::div[contains(@class, "rounded-lg")]').first();
  await form.getByRole('button', { name: /pin note/i }).click();
  
  await page.getByRole('button', { name: /close/i }).click();

  // 3. Assertion
  await expect(page.getByText(/pinned/i, { exact: true }).first()).toBeVisible();
  const pinnedSection = page.getByText(/pinned/i, { exact: true }).first().locator('..');
  await expect(pinnedSection.getByText('Pinned Created Note').first()).toBeVisible();
});
