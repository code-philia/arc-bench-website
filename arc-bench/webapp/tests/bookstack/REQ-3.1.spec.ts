import { test, expect } from '@playwright/test';

test('REQ-3.1: Enter homepage after login', async ({ page }) => {
  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByLabel(/Email/i).fill('admin@admin.com');
  await page.getByRole('textbox', { name: /password/i }).fill('password');
  await page.getByRole('button', { name: /Login/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\//);
  await expect(page.getByText(/Recent Drafts/i)).toBeVisible();
  await expect(page.getByText(/Recently Updated Pages/i)).toBeVisible();
  await expect(page.getByText(/Recent Activity/i)).toBeVisible();
});
