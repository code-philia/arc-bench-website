import { test, expect } from '@playwright/test';

test('REQ-5.3.1: Fill out and Save Book', async ({ page }) => {
  // 1. Navigation
  await page.goto('/books');

  // 2. Interaction
  await page.getByRole('link', { name: /Create New Book/i }).click();
  await page.getByLabel(/Name/i).fill('New Test Book');
  await page.getByLabel(/Description/i).fill('This is a test book description.');
  await page.getByRole('button', { name: /Save Book/i }).click();

  // 3. Assertion
  // Redirected to the new Book details page or Books list
  await expect(page).toHaveURL(/\/books(\/.+)?/);
  await expect(page.getByText(/New Test Book/i)).toBeVisible();
});
