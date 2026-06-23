import { test, expect } from '@playwright/test';

test('REQ-2-1.1: Happy Path - Successful Login', async ({ page }) => {
  // 0. Pre-condition: 确保测试用户存在，.catch(() => {}) 是因为用户已存在时注册接口会报错，属于正常情况可忽略
  // 修改原因：原测试假设用户已存在，环境干净时会因账号不存在而登录失败
  await page.request.post('/api/auth/register', {
    data: { username: 'test_user', email: 'test_user@example.com', password: 'password123' }
  }).catch(() => {});

  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible();
  
  await page.getByLabel(/email/i).fill('test_user@example.com');
  await page.getByRole('textbox', { name: /password/i }).fill('password123');
  await page.getByRole('button', { name: /log in/i }).click();

  // 3. Assertion
  await expect(page).toHaveURL(/\//);
  
  const header = page.getByRole('banner');
  const profileLink = header.getByRole('link')
    .filter({ has: page.getByRole('img') })
    .filter({ hasNot: page.getByRole('img', { name: /logo|stack overflow/i }) })
    .or(header.getByRole('button', { name: /profile|account/i }));

  await expect(profileLink.first()).toBeVisible();
});
