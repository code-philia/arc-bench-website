import { test, expect } from '@playwright/test';

test('REQ-5-3: Upvote Comment', async ({ page }) => {
  // 1. Pre-condition: Register users, create question
  await page.request.post('/api/auth/register', {
    data: { username: 'author_user3', email: 'author3@example.com', password: 'password123' }
  }).catch(() => {});
  await page.request.post('/api/auth/register', {
    data: { username: 'voter_user3', email: 'voter3@example.com', password: 'password123' }
  }).catch(() => {});

  const authorLogin = await page.request.post('/api/auth/login', {
    data: { email: 'author3@example.com', password: 'password123' }
  });
  const authorToken = (await authorLogin.json()).data.token;
  
  // Create question
  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for comment vote check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${authorToken}` }
  });
  const questionId = (await questionRes.json()).data.id;

  // Create comment on the question
  const commentRes = await page.request.post(`/api/questions/${questionId}/comments`, {
    data: { body: 'This is a valid comment body that has enough characters.' },
    headers: { Authorization: `Bearer ${authorToken}` }
  });
  expect(commentRes.status()).toBe(201);

  // Login as voter
  const voterLogin = await page.request.post('/api/auth/login', {
    data: { email: 'voter3@example.com', password: 'password123' }
  });
  const voterToken = (await voterLogin.json()).data.token;
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), voterToken);

  // 2. Navigation
  await page.goto(`/questions/${questionId}`);

  // Ensure auth state is loaded
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();

  // 3. Interaction - Upvote comment
  const upvoteButton = page.getByTitle(/upvote comment/i).first();
  await upvoteButton.click();

  // 4. Assertion
  await expect(upvoteButton).toHaveAttribute('data-voted', 'true');

  // 5. Interaction - Remove upvote
  await upvoteButton.click();
  await expect(upvoteButton).toHaveAttribute('data-voted', 'false');
});
