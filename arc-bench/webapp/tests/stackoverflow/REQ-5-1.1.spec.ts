import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers';

test('REQ-5-1.1: Post Comment on Question or Answer', async ({ page }) => {
  // 1. Pre-condition: Login
  await loginAsTestUser(page);

  // 2. Navigate to a question page (use existing question ID 10)
  await page.goto('/questions/10');

  // 3. Wait for page to load
  await page.waitForLoadState('domcontentloaded');

  // 4. Find and click "Add a comment" button/link (with error handling)
  const addCommentButton = page.getByRole('button', { name: /add a comment/i }).or(page.getByRole('link', { name: /add a comment/i })).first();
  await addCommentButton.click();

  // 5. Fill in comment (with error handling)
  const commentInput = page.getByRole('textbox', { name: /comment/i }).or(page.getByPlaceholder(/comment/i));
  const commentText = 'This is a test comment added to the question.';
  await commentInput.fill(commentText);

  // 6. Submit comment (with error handling)
  const submitButton = page.getByRole('button', { name: /add comment/i });
  await submitButton.click();

  // 7. Verify comment appears (with error handling)
  const commentVisible = await page.getByText(commentText).isVisible().catch(() => false);
  expect(commentVisible).toBe(true);
});
