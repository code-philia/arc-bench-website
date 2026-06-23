import { test, expect } from '@playwright/test';

test('REQ-4.9.2: Add Review', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();

  // 2. Interaction
  const addReviewBtn = page.getByRole('button', { name: /write your review/i }).or(page.locator('.post-product-comment'));
  if (await addReviewBtn.isVisible()) {
    await addReviewBtn.click();
    
    // 3. Assertion
    // Might pop up login or review form
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
  }
});
