import { test, expect } from '@playwright/test';

test('REQ-7-1-2.2: Swap Origin and Destination', async ({ page }) => {
  // 1. Navigation
  await page.goto('/status');

  // 2. Interaction
  await page.getByRole('radio', { name: /搜起降地/i }).check();
  const originInput = page.getByPlaceholder(/出发地/i);
  const destInput = page.getByPlaceholder(/到达地/i);
  await originInput.fill('上海');
  await destInput.fill('北京');
  await page.getByRole('button', { name: /换/i }).click(); // assuming icon is a button

  // 3. Assertion
  await expect(originInput).toHaveValue(/北京/i);
  await expect(destInput).toHaveValue(/上海/i);
});
