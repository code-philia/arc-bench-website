import { Page } from '@playwright/test';

export async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder(/手机号|用户名|邮箱/i).fill('admin');
  await page.getByPlaceholder(/密码/i).fill('4rfv5tgb6yhn');
  await page.getByRole('checkbox', { name: /阅读并同意/i }).check();
  await page.getByRole('button', { name: /登录/i }).click();
  // Wait for the homepage to fully load after login redirect
  await page.waitForURL(/\//, { timeout: 10000 });
  // Wait for the page to be stable (content loaded)
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
}
