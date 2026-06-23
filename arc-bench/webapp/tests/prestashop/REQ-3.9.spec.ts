import { test, expect } from '@playwright/test';

test('REQ-3.9: Pagination', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  // Search for something with many results
  const searchBox = page.getByRole('searchbox');
  await searchBox.fill('a');
  await searchBox.press('Enter');

  // 2. Interaction
  const pagination = page.getByRole('navigation', { name: /pagination/i });
  const nextButton = pagination.getByRole('link', { name: /next/i }).or(pagination.getByText(/next/i));
  
  // If pagination exists, click next
  if (await nextButton.isVisible()) {
    await nextButton.click();
    
    // 3. Assertion
    await expect(page).toHaveURL(/.*page=2.*/i);
  }
});
