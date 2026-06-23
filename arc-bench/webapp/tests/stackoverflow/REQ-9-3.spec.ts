import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToOwnProfile } from './helpers';

test('REQ-9-3: User Questions History', async ({ page }) => {
  // 1. Pre-condition: Login
  await loginAsTestUser(page);

  // 2. Navigation
  await navigateToOwnProfile(page);
  await page.waitForLoadState('domcontentloaded');
  const activityButton = page.getByRole('link', { name: /^activity$/i }).or(page.getByText(/^activity$/i, { exact: true })).first();
  await activityButton.click();

  // 3. Interaction
  const questionsTab = page.getByRole('link', { name: /^questions$/i }).or(page.getByText(/^questions$/i, { exact: true })).first();
  await questionsTab.click();

  // 4. Assertion
  await expect(page.getByRole('heading', { name: /questions/i }).first()).toBeVisible();
});
