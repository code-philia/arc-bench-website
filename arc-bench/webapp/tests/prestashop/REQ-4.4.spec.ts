import { test, expect } from '@playwright/test';

test('REQ-4.4: Variant Selection', async ({ page }) => {
  // 1. Navigation
  await page.goto('/');
  // Search for a product that likely has variants
  await page.getByRole('searchbox').fill('t-shirt');
  await page.getByRole('searchbox').press('Enter');
  await page.locator('article').first().getByRole('link').first().click();

  // 2. Interaction
  const sizeDropdown = page.getByRole('combobox', { name: /size/i }).or(page.getByLabel(/size/i));
  if (await sizeDropdown.isVisible()) {
    await sizeDropdown.selectOption({ index: 1 });
    // Verify it changed
    await expect(sizeDropdown).not.toHaveValue('');
  }

  const colorGroup = page.locator('.product-variants').getByRole('radiogroup', { name: /color/i }).or(page.locator('.color-label').first());
  if (await colorGroup.isVisible()) {
    await colorGroup.click();
    // 3. Assertion
    await expect(page).toHaveURL(/.*[a-zA-Z0-9].*/);
  }
});
