import { test, expect } from '@playwright/test';

test('REQ-5.1: Toggle between list and grid views', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction & Assertion
  // Assuming default is grid, and button shows 'list view'
  await page.getByRole('button', { name: /list view/i }).click();
  await expect(page.getByRole('button', { name: /grid view/i })).toBeVisible();
  
  // Click grid view
  await page.getByRole('button', { name: /grid view/i }).click();
  await expect(page.getByRole('button', { name: /list view/i })).toBeVisible();
});
