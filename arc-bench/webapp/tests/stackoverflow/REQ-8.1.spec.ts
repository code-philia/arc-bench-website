import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToOwnProfile } from './helpers';

test('REQ-8.1: View Reputation History', async ({ page }) => {
  // 1. Pre-condition: Login
  await loginAsTestUser(page);
  
  // 2. Navigation
  await navigateToOwnProfile(page);
  await page.waitForLoadState('domcontentloaded');

  // 3. Interaction
  // From the screenshot, the "Reputation" tab is on the left sidebar
  // It could be a link or just a clickable text item
  const repLink = page.getByRole('link', { name: /^reputation$/i }).or(page.getByText(/^reputation$/i, { exact: true })).first();
  await expect(repLink).toBeVisible();
  
  await repLink.click();

  // 4. Assertion
  // Just check if the reputation component/title becomes visible after clicking,
  // since the URL might not change immediately depending on how the SPA is built.
  const repHeading = page.getByRole('heading', { name: /reputation/i }).first();
  await expect(repHeading).toBeVisible();
});
