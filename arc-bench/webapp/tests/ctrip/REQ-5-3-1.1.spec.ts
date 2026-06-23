import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-5-3-1.1: Search Contacts', async ({ page }) => {
  // 0. Login
  await login(page);

  // Ensure test data exists - add a contact with 张 if not present
  await page.goto('/user/contacts');
  await page.waitForLoadState('networkidle').catch(() => {});

  // Add a contact via API to ensure search works
  const addResponse = await fetch('http://localhost:3003/api/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: 1, name: '张三', phone: '13900000001', email: 'zhangsan@test.com' })
  });
  // Ignore error if already exists

  // Reload page to see updated data
  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => {});

  // 1. Interaction
  await page.getByPlaceholder(/姓名/i).fill('张');
  await page.getByRole('button', { name: /查询|搜索/i }).click();

  // 2. Assertion
  await expect(page.getByText(/张/).first()).toBeVisible();
});
