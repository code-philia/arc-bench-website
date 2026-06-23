import { test, expect } from '@playwright/test';

test('REQ-3-5.2: Downvote Question', async ({ page }) => {
  // 0. Pre-condition: 注册作者和投票用户，作者创建问题，以投票用户身份登录
  // 修改原因：同 REQ-3-5.1，用户不能给自己的问题投票；需要两个账号，作者发问题，voter 来踩
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
    data: { title: 'Test question for downvote check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
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

  // Ensure auth state is loaded
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();

  // 2. Interaction - Downvote
  const downvoteButton = page.getByRole('button', { name: /downvote/i }).first();
  await downvoteButton.click();

  // 3. Assertion
  await expect(downvoteButton).toHaveAttribute('aria-pressed', 'true');
});
