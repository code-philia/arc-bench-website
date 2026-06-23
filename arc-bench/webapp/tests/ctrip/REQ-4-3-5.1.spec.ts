import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-4-3-5.1: Linked Pricing for Value-Added Services', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/book');

  // 2. Wait for services and get initial state
  await page.getByRole('button', { name: /添加保障/i }).first().waitFor();
  const initialPrice = await page.getByText(/订单总价/i).textContent();

  // 3. Interaction - Add insurance service
  const addBtn = page.getByRole('button', { name: /添加保障/i }).first();
  await addBtn.click();

  // 4. Assertion - Price should change
  await expect(page.getByText(/订单总价/i)).not.toHaveText(initialPrice || '');
});
