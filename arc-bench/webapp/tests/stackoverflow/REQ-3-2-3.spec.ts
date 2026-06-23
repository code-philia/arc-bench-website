import { test, expect } from '@playwright/test';

test('REQ-3-2-3: Main Post Content and Tags', async ({ page }) => {
  // 0. Pre-condition: 通过 API 创建问题，并把 token 写入 localStorage 使页面认为已登录
  // 修改原因1：原测试硬编码 /questions/1，不稳定
  // 修改原因2：登录态是必要的，这样页面才会显示 Share/Edit/Follow 等需要登录才能看到的按钮
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'test_user@example.com', password: 'password123' }
  });
  const { token } = (await loginRes.json()).data;
  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for content and tags check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${token}` }
  });
  const questionId = (await questionRes.json()).data.id;
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);

  // 1. Navigation
  await page.goto(`/questions/${questionId}`);

  // 2. Assertion
  const mainContent = page.getByRole('main');
  // 修改原因：Share 在不同实现里可能是 link 也可能是 button，用 .or() 两种都接受
  await expect(mainContent.getByRole('link', { name: /share/i }).or(mainContent.getByRole('button', { name: /share/i })).first()).toBeVisible();
  await expect(mainContent.getByRole('link', { name: /edit/i }).first()).toBeVisible();
  await expect(mainContent.getByRole('button', { name: /follow/i }).first()).toBeVisible();
  
  // Check for at least one tag link
  await expect(mainContent.getByRole('link', { name: /^[a-z0-9-]+$/i }).first()).toBeVisible(); 
});
