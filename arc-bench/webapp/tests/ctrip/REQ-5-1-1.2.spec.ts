import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-1-1.2: No Matching Traveler Found', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/passengers');

  // 2. Interaction
  await page.getByPlaceholder(/姓名/i).fill('aa');
  await page.getByRole('button', { name: /查询|搜索/i }).click();

  // 3. Assertion
  await expect(page.getByText(/未找到/i)).toBeVisible();
});
