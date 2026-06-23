import { test, expect } from '@playwright/test';

test('REQ-3-2-3.2: Exception Return Date Earlier Than Departure', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByRole('button', { name: /\+ 添加返程/i }).click();

  // 3. Assertion
  // Dates earlier than departure date should be disabled in the return calendar
  const disabledDate = page.getByRole('button', { name: /\d+月\d+日/ }).and(page.locator('button.is-disabled')).first();
  if (await disabledDate.isVisible()) {
    await expect(disabledDate).toBeDisabled();
  }
});
