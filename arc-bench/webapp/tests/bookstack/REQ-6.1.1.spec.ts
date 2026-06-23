import { test, expect } from '@playwright/test';

test('REQ-6.1.1: Save Page', async ({ page }) => {
  // 1. Navigation
  await page.goto('/books/1'); // Navigate to a book details page

  // 2. Interaction
  await page.getByRole('link', { name: /New Page/i }).click();
  
  // Note: The rich text editor structure is highly variable. 
  // We'll rely on the placeholder or semantic structure of the editor.
  await page.getByPlaceholder(/Page Title/i).fill('New Test Page');
  
  // Assuming a generic content area can be targeted by role 'textbox' or placeholder
  // For standard contenteditable divs or textareas:
  const contentArea = page.getByRole('textbox').last();
  await contentArea.fill('This is the content of the new test page.');

  await page.getByRole('button', { name: /Save Page/i }).click();

  // 3. Assertion
  // Should return to the book details page or page reading page
  await expect(page).toHaveURL(/\/books\/1(\/page\/.+)?/);
  await expect(page.getByText(/New Test Page/i)).toBeVisible();
});
