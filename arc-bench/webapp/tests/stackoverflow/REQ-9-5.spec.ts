import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToOwnProfile } from './helpers';

test('REQ-9-5: User Responses and Comments', async ({ page }) => {
  // 1. Pre-condition: Login
  await loginAsTestUser(page);

  // 2. Navigation
  await navigateToOwnProfile(page);
  await page.waitForLoadState('domcontentloaded');
  const activityButton = page.getByRole('link', { name: /^activity$/i }).or(page.getByText(/^activity$/i, { exact: true })).first();
  await activityButton.click();

  // 3. Interaction
  // Looking at the screenshot, there is "Responses" tab in the left sidebar
  const responsesTab = page.getByRole('link', { name: /^responses$/i }).or(page.getByText(/^responses$/i, { exact: true })).first();
  await responsesTab.click();

  // 4. Assertion
  await expect(page.getByRole('heading', { name: /responses/i }).first()).toBeVisible();
});
