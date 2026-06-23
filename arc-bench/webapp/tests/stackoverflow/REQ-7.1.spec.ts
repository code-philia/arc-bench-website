import { test, expect } from '@playwright/test';

test('REQ-7.1: Basic Search', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  const searchBox = page.getByRole('textbox', { name: /search/i }).or(page.getByPlaceholder(/search/i));
  await searchBox.fill('react hooks');
  
  // Press enter to search
  await searchBox.press('Enter');

  // Wait for the URL to change
  await page.waitForURL(/\/questions\?search=react%20hooks/i);

  // 3. Assertion
  await expect(page).toHaveURL(/\/questions\?search=react%20hooks/i);
  await expect(page.getByRole('heading', { name: /search results for/i })).toBeVisible();
});
