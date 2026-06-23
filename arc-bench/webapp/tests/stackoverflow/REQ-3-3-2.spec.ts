import { test, expect } from '@playwright/test';

test('REQ-3-3-2: Markdown Body Editor with Preview', async ({ page }) => {
  // 0. Pre-condition: 注册作者（已存在则忽略），通过 API 登录，创建问题，注入 token
  // 修改原因：原测试访问硬编码的 /questions/1/edit，若该问题不属于当前用户则无编辑权限，测试不稳定
  await page.request.post('/api/auth/register', {
    data: { username: 'author_user', email: 'author@example.com', password: 'password123' }
  }).catch(() => {});
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'author@example.com', password: 'password123' }
  });
  const { token } = (await loginRes.json()).data;
  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Original Title for Markdown Edit Test', body: 'Original body content for the markdown edit test question with enough characters.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${token}` }
  });
  const questionId = (await questionRes.json()).data.id;
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);

  // 1. Navigate to edit page
  await page.goto(`/questions/${questionId}/edit`);

  // 2. 等待表单异步预填完成（body 不为空说明 useEffect 已拉取完问题内容），再执行填写
  // 修改原因：如果不等预填完成就直接 fill()，useEffect 后续会覆盖掉填入的值，导致断言失败
  const bodyInput = page.getByLabel(/body/i).or(page.getByRole('textbox', { name: /body/i })).first();
  await expect(bodyInput).not.toHaveValue(''); // 等预填完成
  await bodyInput.fill('**Bold Text**');

  // 3. Assertion - preview section visible and renders markdown
  await expect(page.getByText(/preview/i)).toBeVisible();
  await expect(page.getByText('Bold Text').last()).toBeVisible();
});
