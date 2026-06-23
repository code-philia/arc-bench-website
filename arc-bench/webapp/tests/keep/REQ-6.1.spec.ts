import { test, expect } from '@playwright/test';

test('REQ-6.1: Items and styling', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  // (None)

  // 3. Assertion
  await expect(page.getByRole('navigation').or(page.getByRole('complementary')).or(page.getByLabel(/sidebar/i)).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /notes/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /reminders/i }).first()).toBeVisible();
});
