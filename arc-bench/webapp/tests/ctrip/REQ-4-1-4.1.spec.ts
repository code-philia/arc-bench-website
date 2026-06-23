import { test, expect } from '@playwright/test';

test('REQ-4-1-4.1: Trigger Add Passenger', async ({ page }) => {
  // 1. Navigation
  await page.goto('/book');

  // 2. Count existing passenger forms
  const initialForms = await page.getByPlaceholder(/姓名/i).count();

  // 3. Interaction - Click the add passenger button
  await page.getByRole('button', { name: /新增乘机人/i }).click();

  // 4. Assertion - A new passenger form should appear
  await expect(page.getByPlaceholder(/姓名/i)).toHaveCount(initialForms + 1);
});
