import { test, expect } from '@playwright/test';

test('REQ-4-2: Answer Evaluation (Voting)', async ({ page }) => {
  // 1. Pre-condition: Register users, create question
  await page.request.post('/api/auth/register', {
    data: { username: 'author_user2', email: 'author2@example.com', password: 'password123' }
  }).catch(() => {});
  await page.request.post('/api/auth/register', {
    data: { username: 'voter_user2', email: 'voter2@example.com', password: 'password123' }
  }).catch(() => {});

  const authorLogin = await page.request.post('/api/auth/login', {
    data: { email: 'author2@example.com', password: 'password123' }
  });
  const authorToken = (await authorLogin.json()).data.token;
  
  // Create question
  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for answer vote check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${authorToken}` }
  });
  const questionId = (await questionRes.json()).data.id;

  // Create answer
  const answerRes = await page.request.post(`/api/questions/${questionId}/answers`, {
    data: { body: 'This is a valid answer body that has enough characters to be accepted.' },
    headers: { Authorization: `Bearer ${authorToken}` }
  });

  // Verify the answer was created properly
  expect(answerRes.status()).toBe(201);

  // Login as voter
  const voterLogin = await page.request.post('/api/auth/login', {
    data: { email: 'voter2@example.com', password: 'password123' }
  });
  const voterToken = (await voterLogin.json()).data.token;
  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), voterToken);

  // 2. Navigation
  await page.goto(`/questions/${questionId}`);

  // Ensure auth state is loaded
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();

  // 3. Interaction - Answer Upvote
  // Get the answer's upvote button specifically using its accessible name
  const answerUpvoteButton = page.getByRole('button', { name: /upvote answer/i }).first();
  await answerUpvoteButton.click();

  // 4. Assertion
  // In the implementation, answer userVote toggles the data-voted attribute, or we can check the color/aria-label if it updates
  await expect(answerUpvoteButton).toHaveAttribute('data-voted', 'true');
});
