import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-1-3.2: Batch Delete Travelers', async ({ page }) => {
  // 0. Login
  await login(page);

  // 0.5 Ensure at least 3 passengers exist via API
  const paxRes = await page.request.get('http://localhost:3003/api/passengers');
  const passengers = await paxRes.json();
  if (passengers.length < 3) {
    for (let i = passengers.length; i < 3; i++) {
      await page.request.post('http://localhost:3003/api/passengers', {
        data: { name: `测试旅客${i}`, type: 'adult', id_type: '身份证', id_number: `11010119900101111${i}` }
      });
    }
  }

  // 1. Navigation
  await page.goto('/user/passengers');

  // Wait for table to load
  await page.locator('table').waitFor({ timeout: 10000 });

  // 2. Interaction - Select checkboxes and click batch delete
  await page.locator('table tbody').getByRole('checkbox').nth(0).check();
  await page.locator('table tbody').getByRole('checkbox').nth(1).check();
  await page.getByRole('button', { name: /批量删除/i }).click();

  // 3. Confirm deletion
  await page.getByRole('button', { name: /确定/i }).click();

  // 4. Assertion - The confirm dialog should close
  await expect(page.getByRole('dialog', { name: /确认删除/i })).toBeHidden();
});
