import { test, expect } from '@playwright/test';

test('REQ-5-1.2: View All Comments', async ({ page }) => {
  // 1. Pre-condition: Register user, create question, create answer
  await page.request.post('/api/auth/register', {
    data: { username: 'test_user_view_comments', email: 'test_view_comments@example.com', password: 'password123' }
  }).catch(() => {});

  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'test_view_comments@example.com', password: 'password123' }
  });
  const token = (await loginRes.json()).data.token;

  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for show comments', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
    headers: { Authorization: `Bearer ${token}` }
  });
  const questionId = (await questionRes.json()).data.id;

  const answerRes = await page.request.post(`/api/questions/${questionId}/answers`, {
    data: { body: 'This is a valid answer body that has enough characters to be accepted.' },
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(answerRes.status()).toBe(201);
  
  // 2. Navigation
  await page.goto(`/questions/${questionId}`);

  // Wait for the answers section to load
  await expect(page.getByRole('heading', { name: /1 answers/i })).toBeVisible();

  // 3. Interaction
  const showMoreButton = page.getByRole('button', { name: /^show comments$/i }).or(page.getByRole('link', { name: /^show comments$/i })).first();
  await expect(showMoreButton).toBeVisible();
  
  await showMoreButton.click();

  // 4. Assertion
  // Check that the button is no longer there, meaning comments are expanded
  await expect(showMoreButton).not.toBeVisible();
});
