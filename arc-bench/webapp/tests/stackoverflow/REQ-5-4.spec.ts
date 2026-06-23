import { test, expect } from '@playwright/test';

test('REQ-5-4: Add Comment on Answer', async ({ page }) => {
  // 1. Pre-condition: Register user, create question, create answer
  await page.request.post('/api/auth/register', {
    data: { username: 'test_user_ans_comment', email: 'test_ans_comment@example.com', password: 'password123' }
  }).catch(() => {});

  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'test_ans_comment@example.com', password: 'password123' }
  });
  const token = (await loginRes.json()).data.token;

  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for answer comment check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${token}` }
  });
  const questionId = (await questionRes.json()).data.id;

  const answerRes = await page.request.post(`/api/questions/${questionId}/answers`, {
    data: { body: 'This is a valid answer body that has enough characters to be accepted.' },
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(answerRes.status()).toBe(201);

  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);

  // 2. Navigation
  await page.goto(`/questions/${questionId}`);
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();

  // Wait for answers section to be visible
  await expect(page.getByRole('heading', { name: /1 answers/i })).toBeVisible();

  // 3. Interaction
  // Click "Add a comment" under the answer (the last "Add a comment" button is for the answer)
  const addCommentButton = page.getByRole('button', { name: /^add a comment$/i }).last();
  await addCommentButton.click();

  const commentInput = page.getByPlaceholder(/Add a comment/i).last();
  await commentInput.fill('This is a test comment added to an answer with enough characters.');

  await page.getByRole('button', { name: /^add comment$/i }).last().click();

  // 4. Assertion
  await expect(page.getByText('This is a test comment added to an answer with enough characters.')).toBeVisible();
});
