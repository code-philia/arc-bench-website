import { test, expect } from '@playwright/test';

test('REQ-4-1-5.1: Modify Contact Mobile Number', async ({ page }) => {
  // 1. Navigation
  await page.goto('/book');

  // 2. Interaction
  const phoneInput = page.getByPlaceholder(/联系人手机号/i);
  await phoneInput.fill('13800138000');
  await phoneInput.blur();

  // 3. Assertion - valid number should not trigger error
  await expect(page.getByText(/请输入正确的手机号/i)).toBeHidden();
});
