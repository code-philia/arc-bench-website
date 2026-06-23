import { test, expect } from '@playwright/test';

test('REQ-3-2.2: Swap Origin and Destination', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  const originInput = page.getByPlaceholder(/出发城市/i);
  const destInput = page.getByPlaceholder(/到达城市/i);
  await originInput.fill('北京');
  await destInput.fill('上海');
  await page.getByRole('button', { name: /换/i }).click(); // assuming an icon/button for swap

  // 3. Assertion
  await expect(originInput).toHaveValue(/上海/i);
  await expect(destInput).toHaveValue(/北京/i);
});
