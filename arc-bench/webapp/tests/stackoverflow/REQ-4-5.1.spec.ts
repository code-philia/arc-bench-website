import { test, expect } from '@playwright/test';

test('REQ-4-5.1: Happy Path - Successfully Edit Answer', async ({ page }) => {
  // 1. Pre-condition: Login and create data
  await page.request.post('/api/auth/register', {
    data: { username: 'test_user_edit', email: 'test_edit@example.com', password: 'password123' }
  }).catch(() => {});

  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: 'test_edit@example.com', password: 'password123' }
  });
  const token = (await loginRes.json()).data.token;

  const questionRes = await page.request.post('/api/questions', {
    data: { title: 'Test question for edit answer check', body: 'This is a test question body with enough characters to pass validation requirements for the system.'.repeat(3), tags: ['javascript'] },
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
  // Assuming the first edit link inside the answers section
  const editButton = page.getByRole('button', { name: /^edit$/i }).last();
  await editButton.click();
  
  // page.getByDisplayValue is a Testing Library method, not native Playwright. 
  // In Playwright, we can find a textbox containing specific value using a locator filter or value assertion,
  // or simply get the first visible textbox that isn't the "Your Answer" input.
  const bodyInput = page.getByRole('textbox').filter({ hasText: 'This is a valid answer body' });
  await bodyInput.fill('Updated answer text content that is long enough to pass validation.');
  
  await page.getByRole('button', { name: /^save edits$/i }).click();

  // 4. Assertion
  await expect(page.getByText('Updated answer text content that is long enough to pass validation.')).toBeVisible();
});
