import { test, expect } from '@playwright/test';

test('REQ-4-3: Accepted Answer Selection', async ({ page }) => {
  // 1. Pre-condition: Register users, create question, create answer
  await page.request.post('/api/auth/register', {
    data: { username: 'author_user_accept', email: 'author_accept@example.com', password: 'password123' }
  }).catch(() => {});
  await page.request.post('/api/auth/register', {
    data: { username: 'answer_user_accept', email: 'answer_accept@example.com', password: 'password123' }
  }).catch(() => {});

  const authorLogin = await page.request.post('/api/auth/login', {
    data: { email: 'author_accept@example.com', password: 'password123' }
  });
  const authorToken = (await authorLogin.json()).data.token;

  const answererLogin = await page.request.post('/api/auth/login', {
    data: { email: 'answer_accept@example.com', password: 'password123' }
  });
  const answererToken = (await answererLogin.json()).data.token;

  // Create question
  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for accepted answer check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${authorToken}` }
  });
  const questionId = (await questionRes.json()).data.id;

  // Create answer
  const answerRes = await page.request.post(`/api/questions/${questionId}/answers`, {
    data: { body: 'This is a valid answer body that has enough characters to be accepted.' },
    headers: { Authorization: `Bearer ${answererToken}` }
  });
  expect(answerRes.status()).toBe(201);

  // Login as author to accept the answer
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), authorToken);

  // 2. Navigation
  await page.goto(`/questions/${questionId}`);

  // Ensure auth state is loaded
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();

  // 3. Interaction
  const acceptButton = page.getByRole('button', { name: /accept answer/i }).first();
  await acceptButton.click();

  // 4. Assertion
  await expect(acceptButton).toHaveAttribute('data-accepted', 'true');
});
