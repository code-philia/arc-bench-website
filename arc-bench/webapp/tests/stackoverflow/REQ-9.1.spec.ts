import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToOwnProfile } from './helpers';

test('REQ-9.1: View Activity Tab', async ({ page }) => {
  // 1. Pre-condition: Login using helper
  await loginAsTestUser(page);

  // 2. Navigate to user profile (use direct URL)
  await navigateToOwnProfile(page);
  await page.waitForLoadState('domcontentloaded');

  // 3. Try to find activity button/tab (with error handling)
  const activityButton = page.getByRole('link', { name: /^activity$/i }).or(page.getByText(/^activity$/i, { exact: true })).first();
  await activityButton.click();

  // 4. Wait for activity content to load (with error handling)
  await expect(page).toHaveURL(/tab=summary/i);
  
  // Verify the Summary heading is visible as it's the default activity tab
  // If "Summary" heading isn't there, checking for the "Summary" tab button or link itself being active
  const summaryTab = page.getByRole('link', { name: /^summary$/i }).or(page.getByText(/^summary$/i, { exact: true })).first();
  await expect(summaryTab).toBeVisible();
});
