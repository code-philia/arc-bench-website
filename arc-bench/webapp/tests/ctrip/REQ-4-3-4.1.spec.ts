import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-4-3-4.1: Purchase Lounge Service', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/book');

  // 2. Initial state
  const initialPrice = await page.getByText(/订单总价/i).textContent();

  // 3. Interaction - Click the add button for lounge section
  const addBtn = page.getByRole('button', { name: /添加天府机场/i }).first();
  await addBtn.click();

  // 4. Assertion
  await expect(page.getByText(/订单总价/i)).not.toHaveText(initialPrice || '');
});
