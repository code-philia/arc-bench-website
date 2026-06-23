import { test, expect } from '@playwright/test';

test('REQ-8-2.2: Find More Historical Orders', async ({ page }) => {
  // 1. Navigation
  await page.goto('/reimbursement');

  // 2. Interaction
  await page.getByText(/查看更多一年内订单/i).click();

  // 3. Assertion
  await expect(page.getByRole('list')).toBeVisible();
});
