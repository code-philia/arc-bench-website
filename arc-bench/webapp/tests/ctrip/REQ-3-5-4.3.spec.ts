import { test, expect } from '@playwright/test';

test('REQ-3-5-4.3: Exception No Search Results', async ({ page }) => {
  // 1. Navigation - use params that yield no results
  await page.goto('/flight/list?origin=XXX&destination=YYY&date=2099-12-31');

  // 2. Assertion
  await expect(page.getByText(/未找到相关航班/i)).toBeVisible();
  await expect(page.getByText(/修改搜索条件/i)).toBeVisible();
});
