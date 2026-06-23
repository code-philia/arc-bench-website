import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-1-3.1: Delete a Traveler Record', async ({ page }) => {
  // 0. Login
  await login(page);

  // 0.5 Ensure at least 1 passenger exists via API
  const paxRes = await page.request.get('http://localhost:3003/api/passengers');
  const passengers = await paxRes.json();
  if (passengers.length < 1) {
    await page.request.post('http://localhost:3003/api/passengers', {
      data: { name: '测试旅客', type: 'adult', id_type: '身份证', id_number: '110101199001011111' }
    });
  }

  // 1. Navigation
  await page.goto('/user/passengers');

  // Wait for table to load
  await page.locator('table').waitFor({ timeout: 10000 });

  // 2. Interaction - Click delete button on first row (link-styled, not the disabled batch delete)
  await page.locator('table').getByRole('button', { name: /删除/i }).first().click();

  // 3. Confirm deletion
  await page.getByRole('button', { name: /确定/i }).click();

  // 4. Assertion - The confirm dialog should close
  await expect(page.getByRole('dialog', { name: /确认删除/i })).toBeHidden();
});
