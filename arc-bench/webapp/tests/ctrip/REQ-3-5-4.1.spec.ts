import { test, expect } from '@playwright/test';

test('REQ-3-5-4.1: Expand/Collapse Flight Details', async ({ page }) => {
  // 1. Navigation
  await page.goto('/flight/list');

  // Wait for flights to load
  await page.getByRole('listitem').first().waitFor({ timeout: 10000 });

  // 2. Interaction (Expand)
  await page.getByRole('button', { name: /展开/i }).first().click();
  await expect(page.getByText(/退改规则/i).first()).toBeVisible();

  // 3. Interaction (Collapse)
  await page.getByRole('button', { name: /收起/i }).first().click();
  await expect(page.getByText(/退改规则/i).first()).toBeHidden();
});
