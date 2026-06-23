import { test, expect } from '@playwright/test';

test('REQ-2-4: Edit Profile Management', async ({ page }) => {
  // 1. Pre-condition: 通过 API 登录，把 token 写入浏览器的 localStorage（本地存储），再跳到个人主页
  // 修改原因1：原测试用 UI 表单登录，点击按钮后没有等待跳转完成就直接 goto，session 还没生效
  // 修改原因2：原测试访问 /users/current，该路由不存在；改为从登录响应里取真实 user.id
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'test_user@example.com', password: 'password123' }
  });
  const { token, user } = (await loginRes.json()).data;
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token); // 把 token 注入浏览器，使页面认为已登录
  await page.goto(`/users/${user.id}`);

  // 2. Interaction
  await page.getByRole('button', { name: /edit profile/i }).or(page.getByRole('link', { name: /edit profile/i })).click();
  
  await expect(page.getByLabel(/display name/i)).toBeVisible();
  await page.getByLabel(/display name/i).fill('New Display Name');
  await page.getByLabel(/location/i).fill('New Location');
  await page.getByLabel(/title/i).fill('Senior Developer');
  await page.getByLabel(/about me/i).fill('Hello world, this is my bio.');
  
  await page.getByLabel(/website/i).fill('https://example.com');
  await page.getByLabel(/github/i).fill('https://github.com/example');
  await page.getByLabel(/full name/i).fill('John Doe');

  await page.getByRole('button', { name: /save and copy changes to all public communities/i }).click();

  // 3. Assertion
  await expect(page.getByText(/profile updated successfully/i).or(page.getByText(/saved/i))).toBeVisible();
});
