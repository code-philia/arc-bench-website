import { test, expect } from '@playwright/test';

test('REQ-7.1: Enter Flight Status Page', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction - hover on the sidebar 机票 item to reveal sub-items, then click 航班动态
  const sidebar = page.getByRole('navigation', { name: /主导航/i });
  await sidebar.getByText('机票', { exact: true }).hover();
  await sidebar.getByText('航班动态', { exact: true }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/status/i);
});
