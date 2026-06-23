import { test, expect } from '@playwright/test';

test('REQ-3-2-1: Question Header and Metadata', async ({ page }) => {
  // 1. Pre-condition: 通过 API 创建问题，拿到动态 ID
  // 修改原因：原测试硬编码访问 /questions/1，依赖数据库里预置的数据；环境干净或数据被删时测试失败
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'test_user@example.com', password: 'password123' }
  });
  const { token } = (await loginRes.json()).data;
  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for metadata check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['test'] },
    headers: { Authorization: `Bearer ${token}` }
  });
  const questionId = (await questionRes.json()).data.id;

  // 2. Navigation
  await page.goto(`/questions/${questionId}`);

  // 2. Assertion
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.getByText(/asked/i).first()).toBeVisible();
  await expect(page.getByText(/modified/i).first()).toBeVisible();
  await expect(page.getByText(/viewed/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /ask question/i }).or(page.getByRole('link', { name: /ask question/i }))).toBeVisible();
});
