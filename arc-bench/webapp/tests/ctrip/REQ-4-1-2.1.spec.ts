import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('REQ-4-1-2.1: Quickly Select Passengers', async ({ page }) => {
  // 0. Login
  await login(page);

  // 0.5 Ensure required passengers exist via API
  const paxRes = await page.request.get('http://localhost:3003/api/passengers');
  const passengers = await paxRes.json();
  const hasZhangSan = passengers.some((p: any) => p.name === '张三');
  const hasLiSi = passengers.some((p: any) => p.name === '李四');
  if (!hasZhangSan) {
    await page.request.post('http://localhost:3003/api/passengers', {
      data: { name: '张三', type: 'adult', id_type: '身份证', id_number: '310101199001011234' }
    });
  }
  if (!hasLiSi) {
    await page.request.post('http://localhost:3003/api/passengers', {
      data: { name: '李四', type: 'adult', id_type: '身份证', id_number: '320102199102022345' }
    });
  }

  // 1. Navigation
  await page.goto('/book');

  // 2. Wait for passengers to load then interact
  await page.getByRole('checkbox', { name: /张三/i }).waitFor();
  await page.getByRole('checkbox', { name: /张三/i }).check();
  await page.getByRole('checkbox', { name: /李四/i }).check();

  // 3. Assertion
  await expect(page.getByRole('textbox', { name: /姓名/i }).first()).toHaveValue(/张三/i);
});
