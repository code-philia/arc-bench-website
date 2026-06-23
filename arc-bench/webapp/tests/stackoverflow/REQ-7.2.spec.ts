import { test, expect } from '@playwright/test';

test('REQ-7.2: Filter Questions by Tab', async ({ page }) => {
  // 1. Navigation
  await page.goto('/questions');

  // 2. Interaction
  // Looking for the sort select dropdown based on FilterPanel implementation
  // Using combobox role to find the sort by select
  const sortSelect = page.getByRole('combobox', { name: /sort by/i }).or(page.getByRole('combobox'));
  await sortSelect.selectOption('active');

  // 3. Assertion
  await expect(page).toHaveURL(/sort=active/i);
  
  // Interaction
  await sortSelect.selectOption('unanswered');
  
  // Assertion
  await expect(page).toHaveURL(/sort=unanswered/i);
});
