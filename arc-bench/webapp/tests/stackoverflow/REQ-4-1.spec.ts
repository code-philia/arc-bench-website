import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers';

test('REQ-4-1: Answer Submission (Your Answer)', async ({ page }) => {
  // 1. Pre-condition: Login
  await loginAsTestUser(page);
  
  // 修改原因：原测试点击登录按钮后直接 goto('/questions/1')，登录请求还未完成 session 就没生效
  // waitForURL('/') 等待服务器登录成功后自动跳转到首页，确保 token 已写入，再继续操作
  await page.waitForURL('/');

  // 2. Navigation
  await page.goto('/questions/1');

  // 3. Interaction
  const answerBody = page.getByLabel(/your answer/i).or(page.getByRole('textbox', { name: /your answer/i }));
  await expect(answerBody).toBeVisible();
  
  await answerBody.fill('This is a test answer containing a possible solution for the question.');
  await page.getByRole('button', { name: /post your answer/i }).click();

  // 4. Assertion
  await expect(page.getByText('This is a test answer containing a possible solution for the question.')).toBeVisible();
});
