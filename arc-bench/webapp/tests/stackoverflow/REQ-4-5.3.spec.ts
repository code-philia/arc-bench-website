import { test, expect } from '@playwright/test';

test('REQ-4-5.3: Cancel Answer Editing', async ({ page }) => {
  // 1. Pre-condition: Login and create data
  await page.request.post('/api/auth/register', {
    data: { username: 'test_user_edit_cancel', email: 'test_edit_cancel@example.com', password: 'password123' }
  }).catch(() => {});

  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'test_edit_cancel@example.com', password: 'password123' }
  });
  const token = (await loginRes.json()).data.token;

  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for edit answer cancel check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
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

  // 3. Interaction
  const editButton = page.getByRole('button', { name: /^edit$/i }).last();
  await editButton.click();
  
  const bodyInput = page.getByRole('textbox').filter({ hasText: 'This is a valid answer body' });
  await bodyInput.fill('Some text that will be canceled.');
  
  await page.getByRole('button', { name: /^cancel$/i }).first().click();

  // 4. Assertion
  await expect(page.getByText('Some text that will be canceled.')).not.toBeVisible();
});
