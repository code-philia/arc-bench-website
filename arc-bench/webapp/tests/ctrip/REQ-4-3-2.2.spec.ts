import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-4-3-2.2: Purchase Extra Baggage Allowance', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/book');

  // 2. Initial state
  const initialPrice = await page.getByText(/订单总价/i).textContent();

  // 3. Interaction - Click the add button for baggage section
  const addBtn = page.getByRole('button', { name: /添加托运行李额/i }).first();
  await addBtn.click();

  // 4. Assertion
  await expect(page.getByText(/订单总价/i)).not.toHaveText(initialPrice || '');
});
