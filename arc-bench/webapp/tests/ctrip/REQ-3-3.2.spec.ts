import { test, expect } from '@playwright/test';

test('REQ-3-3.2: Filter by Cabin Class', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  const combobox = page.getByRole('combobox', { name: /不限舱等/i });
  await combobox.selectOption({ label: '经济舱' });

  // 3. Assertion
  await expect(combobox).toHaveValue('economy');
});
