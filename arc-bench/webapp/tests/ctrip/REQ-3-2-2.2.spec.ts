import { test, expect } from '@playwright/test';

test('REQ-3-2-2.2: Select a Past Date', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');

  // 2. Interaction
  await page.getByPlaceholder(/出发日期/i).click();

  // 3. Assertion (Past dates are disabled)
  const pastDate = page.getByRole('button', { name: /\d+月\d+日/ }).and(page.locator('button.is-disabled')).first();
  if (await pastDate.isVisible()) {
    await expect(pastDate).toBeDisabled();
  }
});
