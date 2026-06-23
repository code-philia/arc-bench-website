import { test, expect } from '@playwright/test';

test('REQ-1-2: Sidebar Navigation', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  const sidebar = page.getByRole('navigation').filter({ hasText: /Home.*Questions.*Tags/i });
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole('link', { name: /questions/i }).click();

  // 3. Assertion: Highlight active section and navigate
  await expect(page).toHaveURL(/\/questions/i);
});
