import { test, expect } from '@playwright/test';

test('REQ-5-2.2: Delete Comment', async ({ page }) => {
  // 1. Pre-condition: Login and create data
  await page.request.post('/api/auth/register', {
    data: { username: 'test_user_del_comment', email: 'test_del_comment@example.com', password: 'password123' }
  }).catch(() => {});

  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'test_del_comment@example.com', password: 'password123' }
  });
  const token = (await loginRes.json()).data.token;

  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for delete comment check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${token}` }
  });
  const questionId = (await questionRes.json()).data.id;

  const commentRes = await page.request.post(`/api/questions/${questionId}/comments`, {
    data: { body: 'This is a valid comment body that has enough characters to be accepted.' },
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(commentRes.status()).toBe(201);

  await page.goto('/');
  await page.evaluate((t) => localStorage.setItem('token', t), token);

  // 2. Navigation
  await page.goto(`/questions/${questionId}`);
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();

  // 3. Interaction
  const deleteButton = page.getByTitle(/delete comment/i).first();
  
  page.on('dialog', dialog => dialog.accept());
  await deleteButton.click();

  // 4. Assertion
  await expect(page.getByText('This is a valid comment body that has enough characters to be accepted.')).not.toBeVisible();
});
