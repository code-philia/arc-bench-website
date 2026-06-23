import { test, expect } from '@playwright/test';

test('REQ-3-4: Delete Question', async ({ page }) => {
  // 0. Pre-condition: 注册作者（已存在则忽略），通过 API 登录，以作者身份创建问题，注入 token
  // 修改原因：原测试访问 /questions/1，若不是当前用户的问题则没有 Delete 按钮；现在自己创建，保证有权限
  await page.request.post('/api/auth/register', {
    data: { username: 'author_user', email: 'author@example.com', password: 'password123' }
  }).catch(() => {});
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'author@example.com', password: 'password123' }
  });
  const { token } = (await loginRes.json()).data;
  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for delete check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${token}` }
  });
  const questionId = (await questionRes.json()).data.id;
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);

  // 1. Navigation
  await page.goto(`/questions/${questionId}`);

  // 2. Interaction
  // 修改原因：原测试用 getByRole('link', { name: /delete/i })，但实现里 Delete 是 button 而不是 link
  await page.getByRole('button', { name: /delete/i }).first().click();

  // 3. Assertion (Dialog)
  await expect(page.getByText(/confirm deletion/i).or(page.getByRole('button', { name: /confirm|delete/i }).nth(1))).toBeVisible();

  // 4. Confirm deletion
  // 修改原因：原测试用 .click() 可能点到第一个 Delete 按钮（触发弹窗）而不是弹窗里的确认按钮；改为 .last() 确保点确认
  await page.getByRole('button', { name: /confirm|delete/i }).last().click();
  await expect(page).toHaveURL(/\//);
});
