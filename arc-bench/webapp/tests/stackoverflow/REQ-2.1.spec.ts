import { test, expect } from '@playwright/test';

test('REQ-2.1: Anonymous Session', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction & Assertion
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: /log in/i }).or(header.getByRole('button', { name: /log in/i }))).toBeVisible();
  await expect(header.getByRole('link', { name: /sign up/i }).or(header.getByRole('button', { name: /sign up/i }))).toBeVisible();
});
