import { test, expect } from '@playwright/test';

test('REQ-10-1.1: Enter Domestic Airport Directory', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByText(/更多服务/i).hover();
  await page.getByText(/国内机场大全/i).click();

  // 3. Assertion
  await expect(page).toHaveURL(/airport/i);
  await expect(page.getByRole('tab', { name: /国内机场/i })).toHaveAttribute('aria-selected', 'true');
});
