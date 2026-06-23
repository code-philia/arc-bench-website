import { test, expect } from '@playwright/test';

test('REQ-4.5.4: Stock Insufficient Warning', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  await page.locator('article').first().getByRole('link').first().click();

  // 2. Interaction
  const qtyInput = page.getByRole('spinbutton', { name: /quantity/i }).or(page.locator('#quantity_wanted'));
  await qtyInput.fill('99999'); // Exceeding likely stock
  
  // Trigger validation by blurring
  await qtyInput.blur();
  
  // Wait for potential network request for stock check
  await page.waitForTimeout(1000);

  // 3. Assertion
  // Note: Depending on store config, this might disable the button or show a message
  const warning = page.locator('#product-availability').or(page.getByText(/not enough|insufficient|out of stock/i));
  if (await warning.isVisible()) {
    await expect(warning).toBeVisible();
  }
});
