import { test, expect } from '@playwright/test';
import { loginAsTestUser, navigateToOwnProfile } from './helpers';

test('REQ-2-3: View User Profile', async ({ page }) => {
  // 1. Pre-condition: Login
  await loginAsTestUser(page);
  

  // 2. Navigation
  await navigateToOwnProfile(page);

  // 3. Assertion
  await expect(page).toHaveURL(/\/users\//i);
  
  const activityLocator = page.getByRole('tab', { name: /activity/i })
    .or(page.getByRole('link', { name: /activity/i }));
    
  const summaryLocator = page.getByRole('link', { name: /summary/i })
    .or(page.getByRole('menuitem', { name: /summary/i })
    .or(page.getByRole('button', { name: /summary/i })));

  await expect(activityLocator.or(summaryLocator).first()).toBeVisible();
});
