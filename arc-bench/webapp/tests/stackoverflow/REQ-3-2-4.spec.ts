import { test, expect } from '@playwright/test';

test('REQ-3-2-4: Post Author and Ownership Card', async ({ page }) => {
  // 0. Pre-condition: 通过 API 创建问题，并注入 token 使页面处于登录状态
  // 修改原因：原测试硬编码 /questions/1，不稳定；且作者卡片需要登录态才能完整显示
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'test_user@example.com', password: 'password123' }
  });
  const { token } = (await loginRes.json()).data;
  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for author card check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${token}` }
  });
  const questionId = (await questionRes.json()).data.id;
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);

  // 1. Navigation
  await page.goto(`/questions/${questionId}`);

  // 2. Assertion
  const mainContent = page.getByRole('main');
  await expect(mainContent.getByText(/asked/i).first()).toBeVisible();
  await expect(mainContent.getByRole('img', { name: /avatar/i }).first()).toBeVisible();
  await expect(mainContent.getByRole('link', { name: /^[a-zA-Z0-9_]+$/ }).first()).toBeVisible(); // Username link
});
