import { test, expect } from '@playwright/test';

test('REQ-3-3-4: Guidance Sidebar (How to Edit)', async ({ page }) => {
  // 1. Navigation to Edit page
  await page.goto('/questions/1/edit');

  // 2. Assertion
  const sidebar = page.getByRole('complementary').or(page.locator('aside'));
  await expect(sidebar.getByText(/how to edit/i)).toBeVisible();
});
