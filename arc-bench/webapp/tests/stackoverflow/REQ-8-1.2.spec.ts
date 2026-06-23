import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToOwnProfile } from './helpers';

test('REQ-8-1.2: View All Badges', async ({ page }) => {
  // 1. Pre-condition: Login
  await loginAsTestUser(page);

  // 2. Navigation
  await navigateToOwnProfile(page);
  await page.waitForLoadState('domcontentloaded');

  // 3. Interaction
  // From the screenshot, the "View all badges" link is inside the Badges section on the Summary tab
  // Let's click on the "View all badges" link specifically in the Badges container.
  const allBadgesLink = page.getByRole('link', { name: /view all badges/i });
  
  if (await allBadgesLink.isVisible()) {
    await allBadgesLink.click();
    // 4. Assertion
    await expect(page).toHaveURL(/\/badges/i);
    // Verify the main heading or container for badges is visible
    await expect(page.getByRole('heading', { name: /badges/i }).first()).toBeVisible();
  } else {
    // Or there is a Badges link in the left sidebar menu (nav item)
    // Sometimes it's a div acting as a tab or a link
    const sidebarBadgeLink = page.getByRole('link', { name: /^badges$/i }).or(page.getByText(/^badges$/i, { exact: true })).first();
    
    // As requested: just check if there is a Badges tab/link available
    await expect(sidebarBadgeLink).toBeVisible();
    
    await sidebarBadgeLink.click();
    await expect(page).toHaveURL(/tab=badges/i);
  }
});
