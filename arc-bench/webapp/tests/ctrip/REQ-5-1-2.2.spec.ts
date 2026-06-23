import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-1-2.2: Exception Required-Field Validation', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/passengers/new');

  // 2. Interaction
  await page.getByRole('button', { name: /保存/i }).click();

  // 3. Assertion
  await expect(page.getByText(/中文名与英文名两者必填一项/i).first()).toBeVisible();
});
