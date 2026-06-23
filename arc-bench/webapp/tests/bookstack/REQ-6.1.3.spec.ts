import { test, expect } from '@playwright/test';

test('REQ-6.1.3: Delete Draft', async ({ page }) => {
  // 1. Navigation
  await page.goto('/books/1/page/edit/1'); // Navigate to a page edit view where a draft exists

  // 2. Interaction
  // Click on the draft indicator to access the delete option, if it's a dropdown/modal
  const draftIndicator = page.getByText(/Draft saved/i);
  if (await draftIndicator.isVisible()) {
      await draftIndicator.click();
  }
  
  await page.getByRole('button', { name: /Delete Draft/i }).click();
  await page.getByRole('button', { name: /Confirm/i }).click();

  // 3. Assertion
  // Should redirect back to the book details page
  await expect(page).toHaveURL(/\/books\/1/);
});
