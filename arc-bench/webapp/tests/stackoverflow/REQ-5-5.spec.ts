import { test, expect } from '@playwright/test';

test('REQ-5-5: Reply to Comments', async ({ page }) => {
  // 1. Pre-condition: Register user, create question, create comment
  await page.request.post('/api/auth/register', {
    data: { username: 'test_user_reply', email: 'test_reply@example.com', password: 'password123' }
  }).catch(() => {});

  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'test_reply@example.com', password: 'password123' }
  });
  const token = (await loginRes.json()).data.token;

  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for reply check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${token}` }
  });
  const questionId = (await questionRes.json()).data.id;

  const commentRes = await page.request.post(`/api/questions/${questionId}/comments`, {
    data: { body: 'This is a valid comment body that has enough characters.' },
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(commentRes.status()).toBe(201);

  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);

  // 2. Navigation
  await page.goto(`/questions/${questionId}`);
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();

  // 3. Interaction
  // Note: There is no "Reply" button for comments in the current UI implementation.
  // We need to bypass this if the UI feature isn't implemented, or we test what's there.
  const replyButton = page.getByRole('button', { name: /^reply$/i }).or(page.getByRole('link', { name: /^reply$/i })).first();
  
  if (await replyButton.isVisible()) {
    await replyButton.click();
    const replyInput = page.getByRole('textbox').filter({ hasText: '' });
    await replyInput.fill('Replying to the parent comment with enough characters.');
    await page.getByRole('button', { name: /^reply$/i }).click();
    await expect(page.getByText('Replying to the parent comment with enough characters.')).toBeVisible();
    await expect(page.getByText(/@/i).first()).toBeVisible(); // Mention is added
  } else {
    // Feature not implemented in UI, just pass gracefully to avoid blocking CI
    // Or if instructed to fail:
    await replyButton.click(); // This will timeout and fail if the feature is not there, which is expected
  }
});
