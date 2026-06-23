import { test, expect } from '@playwright/test';

test('ROOT.1: Open System', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Assertion
  await expect(page).toHaveURL(/\//);
});
