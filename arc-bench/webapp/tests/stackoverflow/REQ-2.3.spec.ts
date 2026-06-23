import { test, expect } from '@playwright/test';

test('REQ-2.3: Elevated Privileges', async ({ page }) => {
  // 1. Pre-condition: Login as elevated user
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('admin@example.com');
  await page.getByRole('textbox', { name: /password/i }).fill('adminpass123');
  await page.getByRole('button', { name: /log in/i }).click();

  // 2. Navigation to privilege-gated page
  await page.goto('/admin'); 

  // 3. Assertion: Restricted information is available
  await expect(page.getByRole('heading', { name: /admin|dashboard/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /delete|manage/i }).first()).toBeVisible();
});
