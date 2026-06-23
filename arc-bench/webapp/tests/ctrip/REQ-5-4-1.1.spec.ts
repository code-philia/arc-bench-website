import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-4-1.1: Search Invoice Titles', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/invoices');

  // Wait for table to load
  await page.locator('table').waitFor({ timeout: 10000 });

  // 2. Interaction
  await page.getByPlaceholder(/抬头/i).fill('公司');
  await page.getByRole('button', { name: /查询|搜索/i }).click();

  // 3. Assertion - Wait for search results
  await expect(page.getByText(/公司/).first()).toBeVisible({ timeout: 10000 });
});
