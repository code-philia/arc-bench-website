import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-4-3-5.2: Auto Deduction When Removing Services', async ({ page }) => {
  // 0. Login
  await login(page);

  // 1. Navigation
  await page.goto('/book');

  // 2. Wait for services and setup initial selected state - Add insurance
  await page.getByRole('button', { name: /添加保障/i }).first().waitFor();
  const addBtn = page.getByRole('button', { name: /添加保障/i }).first();
  await addBtn.click();
  const priceWithService = await page.getByText(/订单总价/i).textContent();

  // 3. Interaction (Deselect) - Click the "已添加" button to remove
  const removeBtn = page.getByRole('button', { name: /已添加/i }).first();
  await removeBtn.click();

  // 4. Assertion - Price should change back
  await expect(page.getByText(/订单总价/i)).not.toHaveText(priceWithService || '');
});
