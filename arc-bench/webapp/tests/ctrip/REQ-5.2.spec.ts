import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5.2: Expand/Collapse Common Information', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/center');

  // 2. Interaction (Collapse) - Click to toggle common info section (starts expanded)
  await page.getByText(/常用信息/i).first().click();

  // 3. Assertion - Sub-items should be hidden when collapsed
  await expect(page.getByText(/常用旅客/i)).toBeHidden();

  // 4. Interaction (Expand)
  await page.getByText(/常用信息/i).first().click();

  // 5. Assertion - Sub-items should be visible when expanded
  await expect(page.getByText(/常用旅客/i)).toBeVisible();
});
