import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-4-3.2: Batch Delete Receipts', async ({ page }) => {
  // 0. Login
  await login(page);

  // 0.5 Ensure at least 3 invoice titles exist via API
  const invRes = await page.request.get('http://localhost:3003/api/invoice-titles');
  const invoices = await invRes.json();
  if (invoices.length < 3) {
    for (let i = invoices.length; i < 3; i++) {
      await page.request.post('http://localhost:3003/api/invoice-titles', {
        data: { title_type: 'CORPORATE', title_name: `测试公司${i}`, tax_id: `9131000066238003${i}` }
      });
    }
  }

  // 1. Navigation
  await page.goto('/user/invoices');

  // Wait for table to load
  await page.locator('table').waitFor({ timeout: 10000 });

  // 2. Interaction
  await page.locator('table tbody').getByRole('checkbox').nth(0).check();
  await page.locator('table tbody').getByRole('checkbox').nth(1).check();
  await page.getByRole('button', { name: /批量删除/i }).click();
  await page.getByRole('button', { name: /确定|确认/i }).click();

  // 3. Assertion
  await expect(page.getByText(/删除成功/i)).toBeVisible();
});
