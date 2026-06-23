import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToOwnProfile } from './helpers';

test('REQ-9-2: User Answers History', async ({ page }) => {
  // 1. Pre-condition: Login
  await loginAsTestUser(page);

  // 2. Navigation
  await navigateToOwnProfile(page);
  await page.waitForLoadState('domcontentloaded');
  const activityButton = page.getByRole('link', { name: /^activity$/i }).or(page.getByText(/^activity$/i, { exact: true })).first();
  await activityButton.click();

  // 3. Interaction
  const answersTab = page.getByRole('link', { name: /^answers$/i }).or(page.getByText(/^answers$/i, { exact: true })).first();
  await answersTab.click();

  // 4. Assertion
  await expect(page.getByRole('heading', { name: /answers/i }).first()).toBeVisible();
});
