import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-2-3.2: Batch Delete Addresses', async ({ page }) => {
  // 0. Login
  await login(page);

  // 0.5 Ensure at least 3 addresses exist via API
  const addrRes = await page.request.get('http://localhost:3003/api/addresses');
  const addresses = await addrRes.json();
  if (addresses.length < 3) {
    for (let i = addresses.length; i < 3; i++) {
      await page.request.post('http://localhost:3003/api/addresses', {
        data: { recipient_name: `测试收件人${i}`, detail_address: `测试地址${i}`, phone: '13800138000' }
      });
    }
  }

  // 1. Navigation
  await page.goto('/user/addresses');

  // Wait for table to load
  await page.locator('table').waitFor({ timeout: 10000 });

  // 2. Interaction
  await page.locator('table tbody').getByRole('checkbox').nth(0).check();
  await page.locator('table tbody').getByRole('checkbox').nth(1).check();
  await page.getByRole('button', { name: /批量删除/i }).click();
  await page.getByRole('button', { name: /确定/i }).click();

  // 3. Assertion - Dialog should close
  await expect(page.getByRole('dialog', { name: /确认删除/i })).toBeHidden();
});
