import { test, expect } from '@playwright/test';

test('REQ-3-5.1: Upvote Question', async ({ page }) => {
  // 0. Pre-condition: 注册作者和投票用户，作者创建问题，以投票用户身份登录
  // 修改原因1：原测试用 voter 登录访问 /questions/1，若该问题也是 voter 自己的，系统会禁止自己给自己投票
  // 修改原因2：需要两个不同账号，作者发问题，voter 来投票，才符合真实业务逻辑
  await page.request.post('/api/auth/register', {
    data: { username: 'author_user', email: 'author@example.com', password: 'password123' }
  }).catch(() => {});
  await page.request.post('/api/auth/register', {
    data: { username: 'voter_user', email: 'voter@example.com', password: 'password123' }
  }).catch(() => {});

  const authorLogin = await page.request.post('/api/auth/login', {
    data: { email: 'author@example.com', password: 'password123' }
  });
  const authorToken = (await authorLogin.json()).data.token;
  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for upvote check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${authorToken}` }
  });
  const questionId = (await questionRes.json()).data.id;

  // 切换到 voter 身份：把 voter 的 token 写入 localStorage
  const voterLogin = await page.request.post('/api/auth/login', {
    data: { email: 'voter@example.com', password: 'password123' }
  });
  const voterToken = (await voterLogin.json()).data.token;
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), voterToken);

  // 1. Navigation 
  await page.goto(`/questions/${questionId}`); 
  
  // 确保用户认证状态已加载完成，避免 handleVote 因 user 为 null 而提早返回
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();

  // 2. Interaction - Upvote 
  const upvoteButton = page.getByRole('button', { name: /upvote/i }).first();
  await upvoteButton.click();

  // 3. Assertion - vote registered
  await expect(upvoteButton).toHaveAttribute('aria-pressed', 'true');

  // 4. Interaction - Remove Upvote
  await upvoteButton.click();
  await expect(upvoteButton).toHaveAttribute('aria-pressed', 'false');
});
