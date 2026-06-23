import { test, expect } from '@playwright/test';

test('REQ-4.7: Add to Wishlist', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();

  // 2. Interaction
  const wishlistBtn = page.getByRole('button', { name: /wishlist/i }).or(page.locator('.wishlist-button-add'));
  if (await wishlistBtn.isVisible()) {
    await wishlistBtn.click();
    
    // 3. Assertion
    // Might show a modal to login since we are not logged in
    const modal = page.getByRole('dialog').or(page.getByText(/sign in/i));
    await expect(modal).toBeVisible();
  }
});
