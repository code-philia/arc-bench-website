import { test, expect } from '@playwright/test';

test('REQ-8-2.1: View Eligible Orders', async ({ page }) => {
  // 1. Navigation
  await page.goto('/reimbursement');

  // 2. Interaction
  await page.getByRole('tab', { name: /待开凭证/i }).click();

  // 3. Assertion
  const emptyState = page.getByText(/暂无报销凭证可开具/i);
  const listState = page.getByRole('list');
  await expect(emptyState.or(listState)).toBeVisible();
});
