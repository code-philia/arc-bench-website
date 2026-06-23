import { test, expect } from '@playwright/test';

test('REQ-5.4.1: Save Book Edits', async ({ page }) => {
  // 1. Navigation
  await page.goto('/books/1'); // Navigate to book details

  // 2. Interaction
  await page.getByRole('link', { name: /Edit/i }).click();
  await page.getByLabel(/Name/i).fill('Updated Book Name');
  await page.getByLabel(/Description/i).fill('Updated book description.');
  await page.getByRole('button', { name: /Save Book/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\/books\/1/);
  await expect(page.getByText(/Updated Book Name/i)).toBeVisible();
});
