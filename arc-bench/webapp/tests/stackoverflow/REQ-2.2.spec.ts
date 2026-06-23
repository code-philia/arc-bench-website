import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers';

test('REQ-2.2: Authenticated Session', async ({ page }) => {
  // 1. Pre-condition: User login
  await loginAsTestUser(page);
  
  // 修改原因：原代码点击登录后又手动 goto('/')，相当于在登录请求还没完成时就跳走了，导致 session 没有生效
  // 改为 waitForURL('/') 是等待服务器登录成功后自动跳转到首页，确保 token 已写入
  await page.waitForURL('/');

  // 3. Assertion
  const header = page.getByRole('banner');
  const profileLink = header.getByRole('link')
    .filter({ has: page.getByRole('img') })
    .filter({ hasNot: page.getByRole('img', { name: /logo|stack overflow/i }) })
    .or(header.getByRole('button', { name: /profile|account/i }));

  await expect(profileLink.first()).toBeVisible();
  await expect(header.getByRole('link', { name: /log in/i })).not.toBeVisible();
});
