import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-3-3.1: Delete a Single Contact', async ({ page }) => {
  // 0. Login
  await login(page);

  // 0.5 Ensure at least 1 contact exists via API
  const contactsRes = await page.request.get('http://localhost:3003/api/contacts');
  const contacts = await contactsRes.json();
  if (contacts.length < 1) {
    await page.request.post('http://localhost:3003/api/contacts', {
      data: { name: '测试联系人', phone: '13900000001', email: 'test@test.com' }
    });
  }

  // 1. Navigation
  await page.goto('/user/contacts');

  // Wait for contacts table to load
  await page.locator('table').waitFor({ timeout: 10000 });

  // 2. Interaction
  await page.locator('table tbody').getByRole('button', { name: /删除/i }).first().click();
  await page.getByRole('button', { name: /确定|确认/i }).click();

  // 3. Assertion
  await expect(page.getByText(/删除成功/i)).toBeVisible();
});
