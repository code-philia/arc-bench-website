import { test, expect } from '@playwright/test';

test('REQ-1-3: Main Question Feed', async ({ page }) => {
  // 0. Pre-condition: 通过 API 创建一条问题，确保首页 feed 里有数据可显示
  // 修改原因：原测试依赖数据库里已有的 /questions/1，环境干净时会失败
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'test_user@example.com', password: 'password123' }
  });
  const { token } = (await loginRes.json()).data;
  await page.request.post('/api/questions', {
    data: { title: 'Test question for feed check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['test'] },
    headers: { Authorization: `Bearer ${token}` }
  });

  // 1. Navigation
  await page.goto('/');

  // 2. Interaction & Assertion
  const mainFeed = page.getByRole('main');
  await expect(mainFeed).toBeVisible();
  
  await expect(page.getByRole('link', { name: /ask question/i }).or(page.getByRole('button', { name: /ask question/i }))).toBeVisible();
  await expect(page.getByRole('tab', { name: /newest/i }).or(page.getByRole('link', { name: /newest/i })).or(page.getByRole('button', { name: /newest/i }))).toBeVisible();
  await expect(page.getByRole('tab', { name: /active/i }).or(page.getByRole('link', { name: /active/i })).or(page.getByRole('button', { name: /active/i }))).toBeVisible();
  
  // Verify summary stats presence
  await expect(mainFeed.getByText(/votes/i).first()).toBeVisible();
  await expect(mainFeed.getByText(/answers/i).first()).toBeVisible();
  await expect(mainFeed.getByText(/views/i).first()).toBeVisible();
});
