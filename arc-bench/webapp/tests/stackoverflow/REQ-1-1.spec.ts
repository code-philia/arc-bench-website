import { test, expect } from '@playwright/test';

test('REQ-1-1: Global Navigation Header', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction & Assertion
  const header = page.getByRole('banner');
  await expect(header).toBeVisible();
  
  // Verify logo, search bar, and auth links
  await expect(header.getByRole('link', { name: /logo|stack overflow/i }).first()).toBeVisible();
  await expect(header.getByRole('searchbox').or(header.getByPlaceholder(/search/i))).toBeVisible();
  await expect(header.getByRole('link', { name: /log in/i }).or(header.getByRole('button', { name: /log in/i }))).toBeVisible();
  await expect(header.getByRole('link', { name: /sign up/i }).or(header.getByRole('button', { name: /sign up/i }))).toBeVisible();
});
