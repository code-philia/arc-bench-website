import { test, expect } from '@playwright/test';

test('REQ-4-1-3.2: Exception Invalid ID Number Format', async ({ page }) => {
  // 1. Navigation
  await page.goto('/book');

  // 2. Interaction
  await page.getByPlaceholder(/姓名/i).fill('王五');
  const idInput = page.getByPlaceholder(/身份证/i);
  await idInput.fill('123'); // Invalid format mock
  await idInput.blur();

  // 3. Assertion
  await expect(page.getByText(/请输入正确的证件号码/i)).toBeVisible();
});
