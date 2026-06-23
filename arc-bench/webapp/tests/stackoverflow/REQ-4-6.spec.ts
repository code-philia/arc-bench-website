import { test, expect } from '@playwright/test';

test('REQ-4-6: Delete Answer', async ({ page }) => {
  // 1. Pre-condition: Login and create data
  await page.request.post('/api/auth/register', {
    data: { username: 'test_user_del', email: 'test_del@example.com', password: 'password123' }
  }).catch(() => {});

  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'test_del@example.com', password: 'password123' }
  });
  const token = (await loginRes.json()).data.token;

  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for delete answer check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
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
  const answersRegion = page.getByRole('heading', { name: /1 answers/i }).locator('..');
  const answerDeleteBtn = answersRegion.getByRole('button', { name: /^delete$/i });

  // Add dialog handler before clicking
  page.on('dialog', dialog => dialog.accept());
  
  // Click the delete button specifically in the answers region
  await answerDeleteBtn.click();
  
  // 4. Assertion
  // Wait for the answer to disappear from the page
  await expect(page.getByText('This is a valid answer body that has enough characters to be accepted.')).not.toBeVisible();
  
  // Assert still on question page
  await expect(page).toHaveURL(new RegExp(`/questions/${questionId}`, 'i'));
});
