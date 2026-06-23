import { test, expect } from '@playwright/test';

test('REQ-6.1.2: Save Draft', async ({ page }) => {
  // 1. Navigation
  await page.goto('/books/1/page/create'); // Navigate to page creation/drafting page

  // 2. Interaction
  await page.getByPlaceholder(/Page Title/i).fill('Draft Test Page');
  
  // Fill content to trigger auto-save or manual save
  const contentArea = page.getByRole('textbox').last();
  await contentArea.fill('This is draft content.');

  // Assuming there's a explicit 'Save Draft' button or shortcut simulation
  // To simulate Ctrl+S (or Cmd+S on Mac)
  await page.keyboard.press('Control+s');
  
  // Or if there's a visible button to save draft explicitly:
  // await page.getByRole('button', { name: /Save Draft/i }).click();

  // 3. Assertion
  // Check for the "Draft saved at" notification or indicator
  await expect(page.getByText(/Draft saved/i)).toBeVisible();
});
