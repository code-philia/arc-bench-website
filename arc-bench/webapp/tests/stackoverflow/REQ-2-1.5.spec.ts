import { test, expect } from '@playwright/test';

test('REQ-2-1.5: Error - Incorrect Password', async ({ page }) => {
  // 0. Pre-condition: 确保测试用户存在，.catch(() => {}) 是因为用户已存在时注册接口会报错，属于正常情况可忽略
  // 修改原因：测试密码错误场景，前提是账号本身必须存在，否则报错原因不同，断言会失败
  await page.request.post('/api/auth/register', {
    data: { username: 'test_user', email: 'test_user@example.com', password: 'password123' }
  }).catch(() => {});

  // 1. Navigation
  await page.goto('/login');

  // 2. Interaction
  await page.getByLabel(/email/i).fill('test_user@example.com');
  await page.getByRole('textbox', { name: /password/i }).fill('wrong_password');
  await page.getByRole('button', { name: /log in/i }).click();

  // 3. Assertion
  await expect(page.getByText(/the email or password does not match any account/i)).toBeVisible();
});
