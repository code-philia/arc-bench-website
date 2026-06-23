import { Page } from '@playwright/test';

/**
 * Helper function to login with test credentials
 */
export async function loginAsTestUser(page: Page) {
  await page.goto('/login');

  // Wait for the form to be ready
  await page.getByLabel(/email/i).waitFor({ state: 'visible' });

  // Fill in credentials
  await page.getByLabel(/email/i).fill('test_user@example.com');
  await page.getByRole('textbox', { name: /password/i }).fill('password123');

  // Submit login
  await page.getByRole('button', { name: /log in/i }).click();

  // Wait for navigation to complete
  await page.waitForURL(/\/$/, { timeout: 10000 });
}

/**
 * Helper function to navigate to user profile
 */
export async function navigateToOwnProfile(page: Page) {
    const header = page.getByRole('banner');
    const profileLink = header.getByRole('link')
    .filter({ has: page.getByRole('img') })
    .filter({ hasNot: page.getByRole('img', { name: /logo|stack overflow/i }) })
    .or(header.getByRole('button', { name: /profile|account/i }));
    await profileLink.click();
}
