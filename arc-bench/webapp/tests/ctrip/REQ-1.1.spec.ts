import { test, expect } from '@playwright/test';

test('REQ-1.1: Open Homepage', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Assertion
  await expect(page).toHaveURL(/\//);
});
