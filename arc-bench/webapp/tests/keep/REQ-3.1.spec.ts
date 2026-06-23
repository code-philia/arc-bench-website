import { test, expect } from '@playwright/test';

test('REQ-3.1: Initial suggested filters', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByPlaceholder(/search/i).click();

  // 3. Assertion
  await expect(page.getByText(/label/i).first()).toBeVisible();
  await expect(page.getByText(/color/i).first()).toBeVisible();
});
