import { test, expect } from '@playwright/test';

test('REQ-3-2.1: Default Question View', async ({ page }) => {
  // 1. Navigation
  await page.goto('/questions/1'); // Assuming question ID 1 exists

  // 2. Assertion
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('complementary').or(page.locator('aside'))).toBeVisible(); // Sidebar
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible(); // Question title
});
