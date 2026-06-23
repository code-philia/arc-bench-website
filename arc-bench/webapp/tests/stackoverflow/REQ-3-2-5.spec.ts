import { test, expect } from '@playwright/test';

test('REQ-3-2-5: Question Comments and Inline Interaction', async ({ page }) => {
  // 0. Pre-condition: 注册用户（已存在则忽略），通过 API 登录，创建问题，注入 token
  // 修改原因1：原测试通过 UI 表单登录，点击按钮后没有等待跳转，session 未生效，"Add a comment" 按钮只对登录用户显示
  // 修改原因2：原测试硬编码 /questions/1，改为 API 创建问题拿动态 ID，避免依赖预置数据
  await page.request.post('/api/auth/register', {
    data: { username: 'test_user', email: 'test_user@example.com', password: 'password123' }
  }).catch(() => {});
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'test_user@example.com', password: 'password123' }
  });
  const { token } = (await loginRes.json()).data;
  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for comments check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${token}` }
  });
  const questionId = (await questionRes.json()).data.id;
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);

  // 1. Navigation
  await page.goto(`/questions/${questionId}`);

  // 2. Assertion
  await expect(page.getByRole('button', { name: /add a comment/i }).or(page.getByRole('link', { name: /add a comment/i })).first()).toBeVisible();
});
