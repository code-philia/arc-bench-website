import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-3-3.2: Batch Delete Contacts', async ({ page }) => {
  // 0. Login
  await login(page);

  // 0.5 Ensure at least 3 contacts exist via API
  const contactsRes = await page.request.get('http://localhost:3003/api/contacts');
  const contacts = await contactsRes.json();
  if (contacts.length < 3) {
    // Create additional contacts
    for (let i = contacts.length; i < 3; i++) {
      await page.request.post('http://localhost:3003/api/contacts', {
        data: { name: `测试联系人${i}`, phone: `1390000000${i}`, email: `test${i}@test.com` }
      });
    }
  }

  // 1. Navigation
  await page.goto('/user/contacts');

  // Wait for contacts table to load
  await page.locator('table').waitFor({ timeout: 10000 });

  // 2. Interaction
  await page.locator('table tbody').getByRole('checkbox').nth(0).check();
  await page.locator('table tbody').getByRole('checkbox').nth(1).check();
  await page.getByRole('button', { name: /批量删除/i }).click();
  await page.getByRole('button', { name: /确定|确认/i }).click();

  // 3. Assertion
  await expect(page.getByText(/删除成功/i)).toBeVisible();
});
