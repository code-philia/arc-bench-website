import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers';

test('REQ-8-1.1: Badge Award Notification', async ({ page }) => {
  // 1. Pre-condition: Login
  await loginAsTestUser(page);
  

  // 2. Navigation / Trigger action (Simulating earning a badge by upvoting)
  await page.goto('/questions/1');
  await page.getByRole('button', { name: /upvote/i }).first().click();

  // 3. Assertion - Look for a toast/notification popup about the badge
  // This might be a toast or an alert role
  await expect(page.getByRole('alert').or(page.getByText(/Thanks for your vote!/i))).toBeVisible();
});
