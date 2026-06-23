import { test, expect } from '@playwright/test';

test('REQ-3-2-3.1: Enable Return Trip', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('button', { name: /\+ 添加返程/i }).click();

  // 3. Assertion
  await expect(page.getByLabel(/往返/i)).toBeChecked();
  await expect(page.getByPlaceholder(/返回日期/i)).toBeVisible();
});
