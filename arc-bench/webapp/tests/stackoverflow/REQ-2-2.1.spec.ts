import { test, expect } from '@playwright/test';

test('REQ-2-2.1: Happy Path - Successful Sign up', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.getByRole('link', { name: /sign up/i }).or(page.getByRole('button', { name: /sign up/i })).click();

  // 2. Interaction
  await expect(page.getByLabel(/email/i)).toBeVisible();
  
  const uniqueEmail = `newuser_${Date.now()}@example.com`;
  await page.getByLabel(/email/i).fill(uniqueEmail);
  await page.getByRole('textbox', { name: /password/i }).fill('StrongPass123!');
  await page.getByRole('button', { name: /sign up/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\//);
  
  const header = page.getByRole('banner');
  const profileLink = header.getByRole('link')
    .filter({ has: page.getByRole('img') })
    .filter({ hasNot: page.getByRole('img', { name: /logo|stack overflow/i }) })
    .or(header.getByRole('button', { name: /profile|account/i }));

  await expect(profileLink.first()).toBeVisible();
});
