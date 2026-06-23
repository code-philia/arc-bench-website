import { test, expect } from '@playwright/test';

test('REQ-3-3.1: Enter Edit Mode', async ({ page }) => {
  // 0. Pre-condition: 注册作者（已存在则忽略），通过 API 登录，以作者身份创建问题，注入 token
  // 修改原因：原测试通过 UI 表单登录访问 /questions/1，若 id=1 不是当前用户的问题，页面不会显示 Edit 按钮
  // 现在自己创建问题，保证有编辑权限，Edit 按钮一定存在
  await page.request.post('/api/auth/register', {
    data: { username: 'author_user', email: 'author@example.com', password: 'password123' }
  }).catch(() => {});
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'author@example.com', password: 'password123' }
  });
  const { token } = (await loginRes.json()).data;
  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for edit mode check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${token}` }
  });
  const questionId = (await questionRes.json()).data.id;
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);

  // 1. Navigation
  await page.goto(`/questions/${questionId}`);
  await page.getByRole('link', { name: /edit/i }).first().click();

  // 2. Assertion
  await expect(page).toHaveURL(/\/questions\/\d+\/edit/i);
  await expect(page.getByLabel(/title/i).or(page.getByPlaceholder(/title/i))).toBeVisible();
  await expect(page.getByLabel(/body/i).or(page.getByRole('textbox', { name: /body/i }))).toBeVisible();
});
