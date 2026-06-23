import { test, expect } from '@playwright/test';

test('REQ-4-5-1.2: Switch to Not Traveled', async ({ page }) => {
  // 1. Navigation
  await page.goto('/order/list');

  // 2. Interaction
  await page.getByRole('tab', { name: /未出行/i }).click();

  // 3. Assertion
  const emptyState = page.getByText(/暂无|没有/i);
  const listItems = page.getByRole('listitem');
  await expect(emptyState.or(listItems.first())).toBeVisible();
});
