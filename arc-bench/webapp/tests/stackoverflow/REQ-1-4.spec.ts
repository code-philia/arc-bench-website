import { test, expect } from '@playwright/test';

test('REQ-1-4: Right Sidebar Widgets', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction & Assertion
  const rightSidebar = page.getByRole('complementary').or(page.locator('aside'));
  
  await expect(rightSidebar.getByText(/the overflow blog/i)).toBeVisible();
  await expect(rightSidebar.getByText(/hot network questions/i)).toBeVisible();
});
