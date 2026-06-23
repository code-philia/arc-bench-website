import { test, expect } from '@playwright/test';

test('REQ-10-2.1: Enter International Airport Directory', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByText(/更多服务/i).hover();
  await page.getByText(/国际.*大全/i).click();

  // 3. Assertion
  await expect(page).toHaveURL(/airport/i);
  await expect(page.getByRole('tab', { name: /国际|港澳台/i })).toHaveAttribute('aria-selected', 'true');
});
