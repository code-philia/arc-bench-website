import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-4-2.1: Add a Company Invoice Title', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/user/invoices/new');

  // 2. Interaction
  await page.getByRole('radio', { name: '企业', exact: true }).check();
  await page.getByPlaceholder(/抬头/i).fill('测试公司名称');
  const taxInput = page.getByPlaceholder(/纳税人识别号/i);
  await taxInput.fill('123456789012345');
  await taxInput.blur();

  // 3. Assertion
  // Assuming a valid tax ID format doesn't trigger an error
  await expect(page.getByText(/格式错误|请输入正确的纳税人识别号/i)).toBeHidden();
});
