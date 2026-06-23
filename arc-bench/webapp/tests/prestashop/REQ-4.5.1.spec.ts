import { test, expect } from '@playwright/test';

test('REQ-4.5.1: Increase Quantity', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();

  // 2. Interaction
  const qtyInput = page.getByRole('spinbutton', { name: /quantity/i }).or(page.locator('#quantity_wanted'));
  const initialQty = await qtyInput.inputValue();
  
  const upButton = page.getByRole('button', { name: /increase/i }).or(page.locator('.bootstrap-touchspin-up'));
  await upButton.click();

  // 3. Assertion
  await expect(qtyInput).toHaveValue(String(parseInt(initialQty) + 1));
});
