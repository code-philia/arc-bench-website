import { test, expect } from '@playwright/test';

test('REQ-9.1: Enter Airport Guide', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction - hover on sidebar 机票 to reveal sub-items, then click 机场攻略
  await page.getByText('机票', { exact: true }).hover();
  await page.getByText('机场攻略', { exact: true }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/airport/i);
});
