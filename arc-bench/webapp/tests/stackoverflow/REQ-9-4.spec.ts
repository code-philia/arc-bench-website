import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToOwnProfile } from './helpers';

test('REQ-9-4: Reputation and Engagement Tracking', async ({ page }) => {
  // 1. Pre-condition: Login
  await loginAsTestUser(page);

  // 2. Navigation
  await navigateToOwnProfile(page);
  await page.waitForLoadState('domcontentloaded');
  const activityButton = page.getByRole('link', { name: /^activity$/i }).or(page.getByText(/^activity$/i, { exact: true })).first();
  await activityButton.click();

  // 3. Interaction
  const repTab = page.getByRole('link', { name: /^reputation$/i }).or(page.getByText(/^reputation$/i, { exact: true })).first();
  await repTab.click();

  // 4. Assertion
  await expect(page.getByRole('heading', { name: /reputation/i }).first()).toBeVisible();
  
  // Also check votes (from the screenshot, the tab is named "Votes")
  const votesTab = page.getByRole('link', { name: /^votes$/i }).or(page.getByText(/^votes$/i, { exact: true }));
  await votesTab.first().isVisible()
  await votesTab.first().click();
  await expect(page).toHaveURL(/tab=votes/i);
});
