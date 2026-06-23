import { test, expect } from '@playwright/test';

test('REQ-3-3-1: Title and Tags Editor', async ({ page }) => {
  // 0. Pre-condition: 注册作者（已存在则忽略），通过 API 登录，创建一道问题，注入 token
  // 修改原因1：原测试通过 UI 表单登录且访问 /questions/1/edit，若 id=1 的问题不属于该用户则没有编辑权限
  // 修改原因2：改为 API 创建问题，确保当前用户就是作者，有权访问编辑页
  await page.request.post('/api/auth/register', {
    data: { username: 'author_user', email: 'author@example.com', password: 'password123' }
  }).catch(() => {});
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'author@example.com', password: 'password123' }
  });
  const { token } = (await loginRes.json()).data;
  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Original Title Before Edit', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${token}` }
  });
  const questionId = (await questionRes.json()).data.id;
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);

  // 1. Navigate to edit page
  await page.goto(`/questions/${questionId}/edit`);

  // 2. 等待表单异步预填完成（useEffect 从接口拉取问题数据后才会填入输入框），再执行填写操作
  // 修改原因：如果不等预填完成就直接 fill()，useEffect 会在之后覆盖掉我们填的值
  const titleInput = page.getByLabel(/title/i).or(page.getByPlaceholder(/title/i)).first();
  await expect(titleInput).toHaveValue('Original Title Before Edit'); // 等预填完成
  await titleInput.fill('Updated Title for the Question');
  await expect(titleInput).toHaveValue('Updated Title for the Question');

  const tagsInput = page.getByLabel(/tags/i).or(page.getByPlaceholder(/tags/i)).first();
  await tagsInput.fill('new-tag');
  await expect(tagsInput).toHaveValue('new-tag');
});
